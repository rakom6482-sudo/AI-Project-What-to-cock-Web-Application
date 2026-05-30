/**
 * database.js — JSON file storage, no native compilation needed.
 */
const fs   = require('fs');
const path = require('path');

const DATA_DIR      = path.join(__dirname, 'data');
const USERS_FILE    = path.join(DATA_DIR, 'users.json');
const FAVS_FILE     = path.join(DATA_DIR, 'favorites.json');
const LIKES_FILE    = path.join(DATA_DIR, 'likes.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');

function initDB() {
  if (!fs.existsSync(DATA_DIR))      fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE))    fs.writeFileSync(USERS_FILE, '{}');
  if (!fs.existsSync(FAVS_FILE))     fs.writeFileSync(FAVS_FILE,  '{}');
  if (!fs.existsSync(LIKES_FILE))    fs.writeFileSync(LIKES_FILE, '{}');
  if (!fs.existsSync(COMMENTS_FILE)) fs.writeFileSync(COMMENTS_FILE, '{}');
  console.log('✅ Database ready  (data/ folder)');
}

function read(file)     { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } }
function write(file, d) { fs.writeFileSync(file, JSON.stringify(d, null, 2)); }

module.exports = {
  initDB,
  readUsers:     ()  => read(USERS_FILE),
  writeUsers:    (d) => write(USERS_FILE, d),
  readFavs:      ()  => read(FAVS_FILE),
  writeFavs:     (d) => write(FAVS_FILE, d),
  readLikes:     ()  => read(LIKES_FILE),
  writeLikes:    (d) => write(LIKES_FILE, d),
  readComments:  ()  => read(COMMENTS_FILE),
  writeComments: (d) => write(COMMENTS_FILE, d),
};