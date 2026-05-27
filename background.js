/**
 * background.js
 * Soft teal gradient background with mouse-following sound-wave ripple.
 * The ripple is subtle — just a gentle displacement, not a flashy effect.
 */

(function () {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');

  let W, H;
  let time = 0;

  // Mouse state
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

  // Ripple pool — each triggered by mouse movement
  const ripples = [];

  // ── Resize ──────────────────────────────────────────────────────
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // ── Mouse tracking ───────────────────────────────────────────────
  let lastMouseX = 0, lastMouseY = 0, rippleCooldown = 0;

  window.addEventListener('mousemove', e => {
    mouse.tx = e.clientX / W;
    mouse.ty = e.clientY / H;

    // Spawn a ripple if mouse moved enough and cooldown passed
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist > 18 && rippleCooldown <= 0) {
      ripples.push({ x: e.clientX, y: e.clientY, r: 0, maxR: 90 + Math.random() * 60, alpha: 0.18, age: 0 });
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      rippleCooldown = 8; // frames
    }
  });

  // ── Draw gradient background ─────────────────────────────────────
  function drawBackground() {
    // Slow-breathing gradient: two radial patches that drift slightly with mouse
    const cx = mouse.x * W;
    const cy = mouse.y * H;

    // Base fill
    ctx.fillStyle = '#4f8478';
    ctx.fillRect(0, 0, W, H);

    // Light patch (follows mouse gently)
    const g1 = ctx.createRadialGradient(
      cx * 0.6 + W * 0.2, cy * 0.6 + H * 0.2, 0,
      cx * 0.6 + W * 0.2, cy * 0.6 + H * 0.2, W * 0.65
    );
    g1.addColorStop(0,   'rgba(168, 215, 208, 0.70)');
    g1.addColorStop(0.5, 'rgba(120, 180, 172, 0.35)');
    g1.addColorStop(1,   'rgba(60,  110, 104, 0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);

    // Secondary cooler patch (top-right)
    const g2 = ctx.createRadialGradient(
      W * 0.78 + mouse.x * 20, H * 0.18 + mouse.y * 10, 0,
      W * 0.78 + mouse.x * 20, H * 0.18 + mouse.y * 10, W * 0.5
    );
    g2.addColorStop(0,   'rgba(140, 200, 195, 0.45)');
    g2.addColorStop(0.6, 'rgba(80,  145, 138, 0.20)');
    g2.addColorStop(1,   'rgba(50,  100,  95, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    // Dark bottom-left corner
    const g3 = ctx.createRadialGradient(W * 0.05, H * 0.92, 0, W * 0.05, H * 0.92, W * 0.5);
    g3.addColorStop(0,   'rgba(28, 58, 54, 0.55)');
    g3.addColorStop(1,   'rgba(28, 58, 54, 0)');
    ctx.fillStyle = g3;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Very subtle noise grain (static, stamped once into offscreen) ─
  let grainCanvas = null;

  function buildGrain() {
    grainCanvas = document.createElement('canvas');
    grainCanvas.width  = 256;
    grainCanvas.height = 256;
    const gc  = grainCanvas.getContext('2d');
    const img = gc.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      img.data[i]   = v;
      img.data[i+1] = v;
      img.data[i+2] = v;
      img.data[i+3] = 14; // very faint
    }
    gc.putImageData(img, 0, 0);
  }
  buildGrain();

  function drawGrain() {
    if (!grainCanvas) return;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    const pat = ctx.createPattern(grainCanvas, 'repeat');
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── Draw ripples ─────────────────────────────────────────────────
  function drawRipples() {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r   += 2.2;
      rp.age += 1;
      rp.alpha = 0.18 * (1 - rp.r / rp.maxR);

      if (rp.r >= rp.maxR) {
        ripples.splice(i, 1);
        continue;
      }

      // Draw two concentric faint arcs for a "sound wave" feel
      for (let ring = 0; ring < 2; ring++) {
        const offset = ring * 14;
        const r = rp.r - offset;
        if (r < 0) continue;
        const alpha = rp.alpha * (ring === 0 ? 1 : 0.5);

        ctx.beginPath();
        ctx.arc(rp.x, rp.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(220, 245, 240, ${alpha})`;
        ctx.lineWidth   = 1.2;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ── Main loop ────────────────────────────────────────────────────
  function frame() {
    time++;
    if (rippleCooldown > 0) rippleCooldown--;

    // Smooth mouse lerp
    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;

    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawGrain();
    drawRipples();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();