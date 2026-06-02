require('dotenv').config();

const express = require('express');
const path    = require('path');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const axios   = require('axios');
const fs      = require('fs');

let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch {}

const db = require('./database');

const app    = express();
const PORT   = process.env.PORT   || 3000;
const SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const SPOON  = process.env.SPOONACULAR_API_KEY;

let mailer = null;
if (nodemailer && process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });
  console.log(`📧 Email ready → ${process.env.GMAIL_USER}`);
} else {
  console.log('📧 Email NOT configured — messages saved to data/messages.json only');
}

app.use(cors());
app.use(express.json({ limit: '8mb' }));   // bigger limit for avatar uploads

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth (required) ───────────────────────────────────────────────
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated.' });
  try { req.user = jwt.verify(h.slice(7), SECRET); next(); }
  catch { res.status(401).json({ error: 'Token invalid or expired.' }); }
}
// ── Auth (optional — sets req.user if a valid token is present) ───
function optionalAuth(req, _res, next) {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) { try { req.user = jwt.verify(h.slice(7), SECRET); } catch {} }
  next();
}

// ── Register ──────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required.' });
  const users = db.readUsers();
  if (users[email]) return res.status(409).json({ error: 'An account with this email already exists.' });
  const hash = await bcrypt.hash(password, 10);
  const id   = Date.now().toString();
  users[email] = { id, name, email, hash, bio: '', avatar: '', createdAt: new Date().toISOString() };
  db.writeUsers(users);
  const token = jwt.sign({ id, name, email }, SECRET, { expiresIn: '30d' });
  res.json({ ok: true, token, user: { id, name, email, bio: '', avatar: '', createdAt: users[email].createdAt } });
});

// ── Login ─────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const users = db.readUsers();
  const u = users[email];
  if (!u) return res.status(401).json({ error: 'No account found with this email.' });
  const match = await bcrypt.compare(password, u.hash);
  if (!match) return res.status(401).json({ error: 'Incorrect password.' });
  const token = jwt.sign({ id: u.id, name: u.name, email }, SECRET, { expiresIn: '30d' });
  res.json({ ok: true, token, user: { id: u.id, name: u.name, email, bio: u.bio || '', avatar: u.avatar || '', createdAt: u.createdAt } });
});

// ── Update profile (name, bio, avatar) ────────────────────────────
app.patch('/api/profile', requireAuth, (req, res) => {
  const { name, bio, avatar } = req.body;
  const users = db.readUsers();
  const entry = Object.entries(users).find(([, u]) => u.id === req.user.id);
  if (!entry) return res.status(404).json({ error: 'User not found.' });
  const u = entry[1];
  if (typeof name   === 'string' && name.trim()) u.name = name.trim();
  if (typeof bio    === 'string') u.bio = bio.slice(0, 300);
  if (typeof avatar === 'string') u.avatar = avatar;   // base64 data URL
  db.writeUsers(users);
  res.json({ ok: true, user: { id: u.id, name: u.name, email: u.email, bio: u.bio, avatar: u.avatar, createdAt: u.createdAt } });
});

// ── Favorites ─────────────────────────────────────────────────────
app.get('/api/favorites', requireAuth, (req, res) => res.json(db.readFavs()[req.user.id] || []));
app.post('/api/favorites', requireAuth, (req, res) => {
  const { id, name, image } = req.body;
  const favs = db.readFavs();
  if (!favs[req.user.id]) favs[req.user.id] = [];
  if (!favs[req.user.id].some(f => f.id === String(id))) favs[req.user.id].push({ id: String(id), name, image });
  db.writeFavs(favs); res.json({ ok: true });
});
app.delete('/api/favorites/:recipeId', requireAuth, (req, res) => {
  const favs = db.readFavs();
  if (favs[req.user.id]) favs[req.user.id] = favs[req.user.id].filter(f => f.id !== req.params.recipeId);
  db.writeFavs(favs); res.json({ ok: true });
});

// ── Recipe search (with pagination) ───────────────────────────────
app.get('/api/recipes/search', async (req, res) => {
  if (!SPOON) return res.status(500).json({ error: 'SPOONACULAR_API_KEY not set in .env' });
  const { query, time, equip, diet, offset, sort } = req.query;
  const params = { query: query || '', number: 12, offset: Number(offset) || 0,
    addRecipeInformation: true, fillIngredients: true, apiKey: SPOON };
  if (time  && time  !== 'any') params.maxReadyTime = Number(time);
  if (equip && equip !== 'any') params.equipment    = equip;
  if (diet)                     params.diet         = diet;
  if (sort)                     params.sort         = sort;   // popularity, healthiness, time, price
  try {
    const { data } = await axios.get('https://api.spoonacular.com/recipes/complexSearch', { params });
    res.json(data);   // includes results, totalResults, offset, number
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.response?.data?.message || 'Search failed.' });
  }
});

// ── Recipe detail ─────────────────────────────────────────────────
app.get('/api/recipes/:id', async (req, res) => {
  if (!SPOON) return res.status(500).json({ error: 'SPOONACULAR_API_KEY not set in .env' });
  try {
    const { data } = await axios.get(
      `https://api.spoonacular.com/recipes/${req.params.id}/information`,
      { params: { apiKey: SPOON, includeNutrition: false } }
    );
    res.json(data);
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: 'Could not load recipe details.' });
  }
});

// ── Social: get likes + comments for a recipe ─────────────────────
app.get('/api/recipes/:id/social', optionalAuth, (req, res) => {
  const id = req.params.id;
  const likes    = db.readLikes()[id]    || [];
  const comments = db.readComments()[id] || [];
  res.json({
    likes:     likes.length,
    likedByMe: req.user ? likes.includes(req.user.id) : false,
    comments,
  });
});

// ── Social: toggle a like (login required) ────────────────────────
app.post('/api/recipes/:id/like', requireAuth, (req, res) => {
  const id = req.params.id;
  const all = db.readLikes();
  if (!all[id]) all[id] = [];
  const i = all[id].indexOf(req.user.id);
  let liked;
  if (i === -1) { all[id].push(req.user.id); liked = true; }
  else          { all[id].splice(i, 1);      liked = false; }
  db.writeLikes(all);
  res.json({ ok: true, liked, likes: all[id].length });
});

// ── Social: add a comment (login required) ────────────────────────
app.post('/api/recipes/:id/comment', requireAuth, (req, res) => {
  const id = req.params.id;
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Comment cannot be empty.' });
  const all = db.readComments();
  if (!all[id]) all[id] = [];
  const comment = {
    id: Date.now().toString(),
    userId:   req.user.id,
    userName: req.user.name,
    text:     text.slice(0, 500),
    date:     new Date().toISOString(),
  };
  all[id].push(comment);
  db.writeComments(all);
  res.json({ ok: true, comment });
});

// ── Support ───────────────────────────────────────────────────────
app.post('/api/support', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'All fields required.' });
  try {
    const DATA_DIR  = path.join(__dirname, 'data');
    const MSGS_FILE = path.join(DATA_DIR, 'messages.json');
    if (!fs.existsSync(DATA_DIR))  fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(MSGS_FILE)) fs.writeFileSync(MSGS_FILE, '[]');
    const msgs = JSON.parse(fs.readFileSync(MSGS_FILE, 'utf8'));
    msgs.push({ id: Date.now(), name, email, message, receivedAt: new Date().toISOString(), read: false });
    fs.writeFileSync(MSGS_FILE, JSON.stringify(msgs, null, 2));
  } catch (e) { console.error('Could not save message:', e.message); }

  res.json({ ok: true });

  if (mailer) {
    mailer.sendMail({
      from: `"FridgeChef" <${process.env.GMAIL_USER}>`,
      to:   process.env.GMAIL_USER,
      subject: `New message from ${name}`,
      html: `<h3>From: ${name} &lt;${email}&gt;</h3><p>${String(message).replace(/\n/g,'<br>')}</p>`,
    }).then(() => console.log(`📧 Support email sent from ${email}`))
      .catch(err => console.error('Email failed (message still saved):', err.message));
  }
});

app.get('/api/ping', (_req, res) => res.json({ pong: true }));

app.use((err, _req, res, _next) => {
  console.error('Request error:', err.message);
  if (!res.headersSent) res.status(500).json({ error: 'Server error.' });
});
process.on('uncaughtException',  e => console.error('Uncaught:', e.message));
process.on('unhandledRejection', e => console.error('Unhandled:', e?.message || e));

db.initDB();
app.listen(PORT, () => console.log(`🥬 FridgeChef → http://localhost:${PORT}`));