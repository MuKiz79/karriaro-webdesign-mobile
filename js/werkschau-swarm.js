/*
 * Karriaro — Werkschau-Partikelschwarm (Sprint 225)
 *
 * Handcodierter Vanilla-Canvas-Partikel-Morph. KEIN Three.js, KEIN Plugin —
 * exakt der Beweis, den die Seite verkauft (Performance-Budget: vanilla only).
 *
 * Formen:  Blüte (= Phyllotaxis-Siegel, θ=137,5°, Gold = Fibonacci)
 *          Wortmarke "KARRIARO" · Rakete · Haus  (per Pixel-Sampling)
 * Physik:  Maus-Repulsion + Spring-Rückkehr, Klick = Explosion.
 * Guards:  Bootstrap injiziert dieses Script NUR auf Desktop ohne
 *          prefers-reduced-motion (siehe werkschau.html). Loop pausiert,
 *          wenn die Sektion aus dem Viewport scrollt oder der Tab inaktiv ist.
 */
(function () {
  'use strict';
  var canvas = document.getElementById('kr-swarm');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var box = canvas.parentElement;

  // ── Palette (Creme/Gold auf Navy — Deep-Moment-Sektion) ───────────────────
  var CREME = '#ECE6D8';
  var GOLD = '#C9A24B';
  var GOLDEN_ANGLE = (3 - Math.sqrt(5)) * Math.PI; // 137,50776°
  var FIB = { 1:1, 2:1, 3:1, 5:1, 8:1, 13:1, 21:1, 34:1, 55:1, 89:1, 144:1, 233:1, 377:1, 610:1, 987:1 };

  var N = 1200;                 // Partikelzahl (gecappt — Performance-Budget)
  var SPRING = 0.018;           // Rückstellkraft zur Zielform
  var FRICTION = 0.86;          // Dämpfung
  var MOUSE_R = 120;            // Repulsions-Radius (CSS-px)
  var MOUSE_F = 2.6;            // Repulsions-Stärke

  var W = 0, H = 0, DPR = 1;
  var px = new Float32Array(N), py = new Float32Array(N);
  var vx = new Float32Array(N), vy = new Float32Array(N);
  var tx = new Float32Array(N), ty = new Float32Array(N);
  var gold = new Uint8Array(N);
  var forms = {};
  var current = 'bloom';
  var mx = -9999, my = -9999, mouseOn = false;
  var running = false, rafId = 0;

  // ── Form-Generatoren ──────────────────────────────────────────────────────
  // Blüte: analytisch (identisch zum Marken-Siegel in gruender.html).
  function bloom() {
    var pts = new Array(N);
    var R = Math.min(W, H) * 0.40, c = R / Math.sqrt(N);
    var cx = W / 2, cy = H / 2;
    for (var n = 1; n <= N; n++) {
      var r = c * Math.sqrt(n), a = n * GOLDEN_ANGLE;
      pts[n - 1] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), g: FIB[n] === 1 ? 1 : 0 };
    }
    return pts;
  }

  // Sampling: Form in ein Offscreen-Canvas zeichnen, gefüllte Pixel sammeln,
  // auf N Zielpunkte ziehen, aspect-erhaltend in den Canvas einpassen.
  function sample(draw, ow, oh) {
    var o = document.createElement('canvas');
    o.width = ow; o.height = oh;
    var octx = o.getContext('2d');
    octx.fillStyle = '#fff';
    draw(octx, ow, oh);
    var data = octx.getImageData(0, 0, ow, oh).data;
    var filled = [];
    for (var y = 0; y < oh; y += 2) {
      for (var x = 0; x < ow; x += 2) {
        if (data[(y * ow + x) * 4 + 3] > 128) filled.push(x, y);
      }
    }
    var count = filled.length / 2;
    var scale = Math.min((W * 0.78) / ow, (H * 0.72) / oh);
    var cx = W / 2, cy = H / 2;
    var pts = new Array(N);
    for (var i = 0; i < N; i++) {
      var k = (count > 0 ? ((Math.random() * count) | 0) : 0) * 2;
      var sx = filled[k] || ow / 2, sy = filled[k + 1] || oh / 2;
      pts[i] = {
        x: cx + (sx - ow / 2) * scale,
        y: cy + (sy - oh / 2) * scale,
        g: (i % 13 === 0) ? 1 : 0
      };
    }
    return pts;
  }

  function wordmark() {
    return sample(function (c, w, h) {
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = '800 132px Georgia, "Times New Roman", serif';
      c.fillText('KARRIARO', w / 2, h / 2 + 4);
    }, 760, 180);
  }

  function rocket() {
    return sample(function (c, w, h) {
      var cx = w / 2;
      c.fillStyle = '#fff';
      // Rumpf + Nase (Spitzbogen)
      c.beginPath();
      c.moveTo(cx, h * 0.06);
      c.bezierCurveTo(cx + w * 0.20, h * 0.30, cx + w * 0.18, h * 0.62, cx + w * 0.16, h * 0.74);
      c.lineTo(cx - w * 0.16, h * 0.74);
      c.bezierCurveTo(cx - w * 0.18, h * 0.62, cx - w * 0.20, h * 0.30, cx, h * 0.06);
      c.closePath(); c.fill();
      // Finnen
      c.beginPath();
      c.moveTo(cx - w * 0.16, h * 0.56); c.lineTo(cx - w * 0.34, h * 0.80); c.lineTo(cx - w * 0.16, h * 0.78); c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(cx + w * 0.16, h * 0.56); c.lineTo(cx + w * 0.34, h * 0.80); c.lineTo(cx + w * 0.16, h * 0.78); c.closePath(); c.fill();
      // Flamme
      c.beginPath();
      c.moveTo(cx - w * 0.09, h * 0.74); c.lineTo(cx, h * 0.96); c.lineTo(cx + w * 0.09, h * 0.74); c.closePath(); c.fill();
    }, 360, 360);
  }

  function house() {
    return sample(function (c, w, h) {
      c.fillStyle = '#fff';
      // Dach
      c.beginPath();
      c.moveTo(w * 0.50, h * 0.10); c.lineTo(w * 0.92, h * 0.44); c.lineTo(w * 0.08, h * 0.44); c.closePath(); c.fill();
      // Korpus
      c.fillRect(w * 0.18, h * 0.44, w * 0.64, h * 0.46);
      // Tür ausstanzen
      c.globalCompositeOperation = 'destination-out';
      c.fillRect(w * 0.44, h * 0.62, w * 0.14, h * 0.28);
      c.globalCompositeOperation = 'source-over';
    }, 360, 360);
  }

  var GENERATORS = { bloom: bloom, wordmark: wordmark, rocket: rocket, house: house };

  function buildForms() {
    for (var key in GENERATORS) forms[key] = GENERATORS[key]();
  }

  function assign(name) {
    current = name;
    var pts = forms[name];
    for (var i = 0; i < N; i++) {
      tx[i] = pts[i].x; ty[i] = pts[i].y; gold[i] = pts[i].g;
    }
  }

  // ── Layout ────────────────────────────────────────────────────────────────
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var r = box.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = (W * DPR) | 0; canvas.height = (H * DPR) | 0;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var seeded = forms.bloom !== undefined;
    buildForms();
    assign(current);
    if (!seeded) { // Erststart: Partikel zufällig streuen → fliegen in Form
      for (var i = 0; i < N; i++) { px[i] = Math.random() * W; py[i] = Math.random() * H; }
    }
  }

  // ── Physik + Render ─────────────────────────────────────────────────────────
  function step() {
    for (var i = 0; i < N; i++) {
      var ax = (tx[i] - px[i]) * SPRING;
      var ay = (ty[i] - py[i]) * SPRING;
      if (mouseOn) {
        var dx = px[i] - mx, dy = py[i] - my;
        var d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_R * MOUSE_R) {
          var d = Math.sqrt(d2) || 1;
          var f = (1 - d / MOUSE_R) * MOUSE_F;
          ax += (dx / d) * f; ay += (dy / d) * f;
        }
      }
      vx[i] = (vx[i] + ax) * FRICTION;
      vy[i] = (vy[i] + ay) * FRICTION;
      px[i] += vx[i]; py[i] += vy[i];
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var i;
    ctx.fillStyle = CREME;
    for (i = 0; i < N; i++) if (!gold[i]) ctx.fillRect(px[i] - 0.9, py[i] - 0.9, 1.8, 1.8);
    ctx.fillStyle = GOLD;
    for (i = 0; i < N; i++) if (gold[i]) ctx.fillRect(px[i] - 1.1, py[i] - 1.1, 2.2, 2.2);
  }

  function loop() { step(); draw(); rafId = requestAnimationFrame(loop); }
  function start() { if (running) return; running = true; rafId = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(rafId); }

  // ── Interaktion ─────────────────────────────────────────────────────────────
  function pointerMove(e) {
    var r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top; mouseOn = true;
  }
  function explode(e) {
    var r = canvas.getBoundingClientRect();
    var ex = e.clientX - r.left, ey = e.clientY - r.top;
    for (var i = 0; i < N; i++) {
      var dx = px[i] - ex, dy = py[i] - ey;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var f = Math.min(28, 2600 / d);
      vx[i] += (dx / d) * f; vy[i] += (dy / d) * f;
    }
  }

  canvas.addEventListener('mousemove', pointerMove);
  canvas.addEventListener('mouseleave', function () { mouseOn = false; mx = my = -9999; });
  canvas.addEventListener('pointerdown', explode);

  var buttons = document.querySelectorAll('[data-form]');
  Array.prototype.forEach.call(buttons, function (btn) {
    btn.addEventListener('click', function () {
      var name = btn.getAttribute('data-form');
      if (!forms[name]) return;
      assign(name);
      Array.prototype.forEach.call(buttons, function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
  });

  // ── Lifecycle: lazy-start im Viewport, Pause bei Tab-Wechsel ─────────────────
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (visible) start();
  });

  var visible = false;
  var io = new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible && !document.hidden) start(); else stop();
  }, { threshold: 0.08 });

  // Poster ausblenden, Canvas zeigen, Engine starten.
  box.classList.add('is-live');
  resize();
  io.observe(box);
})();
