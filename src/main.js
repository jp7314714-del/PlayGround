import * as THREE from 'three';
import './style.css';

/* ============================================================
   FUTBOL 3D estilo FC Mobile — Phone / Tablet Android (PWA)
   5v5 arcade, joystick táctil + botones, IA, física propia.
   ============================================================ */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- Config ----------
const FIELD_W = 40, FIELD_L = 68;      // metros
const HX = FIELD_W / 2, HZ = FIELD_L / 2;
const GOAL_W = 11, GOAL_H = 3.2, GOAL_D = 3;
const OPT = { difficulty: 'normal', minutes: 4, quality: 'auto' };
const DIFF = {
  easy:   { cpuSpeed: 6.2, cpuReact: 0.55, cpuShotErr: 3.2, tackle: 0.35 },
  normal: { cpuSpeed: 7.2, cpuReact: 0.8,  cpuShotErr: 2.2, tackle: 0.6 },
  hard:   { cpuSpeed: 8.1, cpuReact: 1.0,  cpuShotErr: 1.3, tackle: 0.85 },
};

// ---------- DOM ----------
document.getElementById('app').innerHTML = `
<canvas id="game-canvas"></canvas>
<div id="hud-top"><div id="scoreboard">
  <span class="team"><span class="badge-you">TÚ</span><small>AZUL</small></span>
  <span id="score">0 - 0</span>
  <span class="team"><span class="badge-cpu">CPU</span><small>ROJO</small></span>
  <span id="mtime">04:00</span>
</div></div>
<div id="btn-row">
  <button class="icon-btn" id="btn-cam" title="Cámara">📷</button>
  <button class="icon-btn" id="btn-pause" title="Pausa">⏸</button>
  <button class="icon-btn" id="btn-menu" title="Menú">☰</button>
</div>
<div id="touch-ui">
  <div id="joy-zone"><div id="joy-hint">🕹️<br>Mueve</div><div id="joy-base"><div id="joy-knob"></div></div></div>
  <div id="actions">
    <button class="abtn" id="btn-sprint" title="Sprint">⚡<small>SPRINT</small></button>
    <button class="abtn" id="btn-switch" title="Cambiar">⇄<small>CAMBIO</small></button>
    <button class="abtn" id="btn-pass" title="Pasar">🅰<small>PASE</small></button>
    <button class="abtn" id="btn-shoot" title="Tirar">🅱<small>TIRO</small></button>
  </div>
</div>
<div id="hint-bar">Joystick: mover • A: pase • B: tiro • ⇄: cambiar</div>
<div id="goal-flash" class="hidden"><div>¡GOOOOL! ⚽</div></div>
<div id="rotate-warn"><div>🔄 Gira tu teléfono a <b>horizontal</b> para jugar como en FC Mobile 📱➡️🎮</div></div>
<div id="menu" class="overlay">
  <div class="card">
    <div style="font-size:44px">⚽</div>
    <h1>FÚTBOL <span>3D</span> · FC MOBILE</h1>
    <p>Juego 3D para <b>Android Phone / Tablet</b> · 5v5 arcade · Instalable como app (Chrome ⋮ → <b>Instalar app</b>) · Funciona offline tras cargar.</p>
    <div class="opt-label">DIFICULTAD</div>
    <div class="row" id="row-diff">
      <button class="pill" data-v="easy">FÁCIL</button>
      <button class="pill sel" data-v="normal">NORMAL</button>
      <button class="pill" data-v="hard">DIFÍCIL</button>
    </div>
    <div class="opt-label">DURACIÓN</div>
    <div class="row" id="row-min">
      <button class="pill" data-v="2">2 MIN</button>
      <button class="pill sel" data-v="4">4 MIN</button>
      <button class="pill" data-v="6">6 MIN</button>
    </div>
    <div class="opt-label">CALIDAD (TABLET = ALTA)</div>
    <div class="row" id="row-q">
      <button class="pill sel" data-v="auto">AUTO</button>
      <button class="pill" data-v="low">BATERÍA</button>
      <button class="pill" data-v="high">HD</button>
    </div>
    <button id="btn-play">▶ JUGAR PARTIDO</button>
    <div class="tips">🎮 <b>Cómo jugar:</b> joystick izquierdo para correr · <b>A</b> pase · <b>B</b> tiro (apunta con joystick) · <b>⇄</b> cambiar jugador · <b>⚡</b> sprint.<br>⌨️ En PC: WASD/flechas + J=pase, K=tiro, L=cambio, Shift=sprint.<br>📷 Cambia cámara: Seguimiento / Lateral TV / Alta.</div>
  </div>
</div>
<div id="pause" class="overlay hidden"><div class="card">
  <h1>⏸ PAUSA</h1><p id="pause-info"></p>
  <button id="btn-play2" class="pill sel" style="font-size:18px;padding:12px 26px">▶ SEGUIR</button>
  <div class="row"><button class="pill" id="btn-quit">SALIR AL MENÚ</button></div>
</div></div>
<div id="fulltime" class="overlay hidden"><div class="card">
  <div style="font-size:44px" id="ft-emoji">🏆</div>
  <h1 id="ft-title">¡FINAL!</h1><p id="ft-score" style="font-size:26px;font-weight:900"></p>
  <p id="ft-sub"></p>
  <button id="btn-play3" class="pill sel" style="font-size:18px;padding:12px 26px">🔁 REVANCHA</button>
  <div class="row"><button class="pill" id="btn-quit2">MENÚ</button></div>
</div></div>
<div id="loading"><div class="spinner"></div><div>Cargando estadio…</div></div>`;

function pillRow(id, cb) {
  const row = $(id);
  row.addEventListener('click', (e) => {
    const b = e.target.closest('.pill'); if (!b) return;
    row.querySelectorAll('.pill').forEach((x) => x.classList.remove('sel'));
    b.classList.add('sel'); cb(b.dataset.v);
  });
}
pillRow('row-diff', (v) => (OPT.difficulty = v));
pillRow('row-min', (v) => (OPT.minutes = +v));
pillRow('row-q', (v) => (OPT.quality = v));

// ---------- Audio (procedural, sin assets) ----------
let AC = null;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (AC?.state === 'suspended') AC.resume(); return AC; }
function tone(f, t = 0.12, type = 'sine', g = 0.18, when = 0) {
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), gn = ac.createGain();
  o.type = type; o.frequency.value = f;
  const s = ac.currentTime + when;
  gn.gain.setValueAtTime(g, s); gn.gain.exponentialRampToValueAtTime(0.001, s + t);
  o.connect(gn).connect(ac.destination); o.start(s); o.stop(s + t + 0.02);
}
const sfx = {
  kick: () => tone(160, 0.1, 'square', 0.12),
  pass: () => tone(320, 0.08, 'triangle', 0.12),
  whistle: (n = 1) => { for (let i = 0; i < n; i++) tone(2100, 0.35, 'square', 0.08, i * 0.45); },
  goal: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.1, i * 0.12)); },
  click: () => tone(600, 0.06, 'sine', 0.1),
};

// ---------- Three setup ----------
const canvas = $('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1e3a);
scene.fog = new THREE.Fog(0x0b1e3a, 90, 220);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 26, -30);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
function applyQuality() {
  const tablet = Math.min(innerWidth, innerHeight) > 500 || innerWidth > 1100;
  let q = OPT.quality;
  if (q === 'auto') q = tablet ? 'high' : 'medium';
  if (q === 'high') { renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.shadowMap.enabled = true; }
  else if (q === 'medium') { renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; }
  else { renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; }
  renderer.setSize(innerWidth, innerHeight, false);
}
applyQuality();

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x1d4d2b, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(30, 60, -20); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 160;
scene.add(sun);

// ---------- Estadio ----------
function stripeTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#159a3c'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#0f8a34'; g.fillRect(0, 0, 128, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 8);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
{
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W + 26, FIELD_L + 26),
    new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const y = 0.02;
  const add = (w, l, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), lineMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m);
  };
  // borde
  add(FIELD_W + 0.4, 0.4, 0, -HZ); add(FIELD_W + 0.4, 0.4, 0, HZ);
  add(0.4, FIELD_L, -HX, 0); add(0.4, FIELD_L, HX, 0);
  add(FIELD_W, 0.3, 0, 0); // medio
  // círculo central
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.7, 6, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = y; scene.add(ring);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), lineMat);
  dot.rotation.x = -Math.PI / 2; dot.position.y = y; scene.add(dot);
  // áreas
  const boxW = 22, boxD = 7, smallW = 12, smallD = 2.5;
  add(boxW, 0.4, 0, -HZ + boxD); add(boxW, 0.4, 0, HZ - boxD);
  add(0.4, boxD, -boxW / 2, -HZ + boxD / 2); add(0.4, boxD, boxW / 2, -HZ + boxD / 2);
  add(0.4, boxD, -boxW / 2, HZ - boxD / 2); add(0.4, boxD, boxW / 2, HZ - boxD / 2);
  add(smallW, 0.35, 0, -HZ + smallD); add(smallW, 0.35, 0, HZ - smallD);
  const pen1 = new THREE.Mesh(new THREE.CircleGeometry(0.4, 12), lineMat);
  pen1.rotation.x = -Math.PI / 2; pen1.position.set(0, y, -HZ + 11); scene.add(pen1);
  const pen2 = pen1.clone(); pen2.position.z = HZ - 11; scene.add(pen2);

  // porterías
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const netMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    const z = s * HZ;
    for (const x of [-GOAL_W / 2, GOAL_W / 2]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, GOAL_H, 10), postMat);
      p.position.set(x, GOAL_H / 2, z); p.castShadow = true; g.add(p);
    }
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, GOAL_W + 0.3, 10), postMat);
    cross.rotation.z = Math.PI / 2; cross.position.set(0, GOAL_H, z); g.add(cross);
    const net = new THREE.Mesh(new THREE.BoxGeometry(GOAL_W, GOAL_H, GOAL_D), netMat);
    net.position.set(0, GOAL_H / 2, z + s * GOAL_D / 2); g.add(net);
    scene.add(g);
  }
  // gradas + vallas + focos (barato y resultón)
  const standMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 1 });
  const standMat2 = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 1 });
  const mkStand = (w, x, z, ry, mat) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, 10, 8), mat);
    s.position.set(x, 5, z); s.rotation.y = ry; scene.add(s);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, 10), new THREE.MeshStandardMaterial({ color: 0x111827 }));
    roof.position.set(x, 10.4, z); roof.rotation.y = ry; scene.add(roof);
  };
  mkStand(FIELD_L + 30, -HX - 16, 0, Math.PI / 2, standMat);
  mkStand(FIELD_L + 30, HX + 16, 0, Math.PI / 2, standMat);
  mkStand(FIELD_W + 44, 0, -HZ - 16, 0, standMat2);
  mkStand(FIELD_W + 44, 0, HZ + 16, 0, standMat2);
  // público (puntos de colores = barato)
  {
    const n = 1500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const side = i % 4;
      if (side === 0) { pos[i * 3] = -HX - 16 + (Math.random() - 0.5) * 4; pos[i * 3 + 2] = (Math.random() - 0.5) * (FIELD_L + 24); }
      else if (side === 1) { pos[i * 3] = HX + 16 + (Math.random() - 0.5) * 4; pos[i * 3 + 2] = (Math.random() - 0.5) * (FIELD_L + 24); }
      else if (side === 2) { pos[i * 3] = (Math.random() - 0.5) * (FIELD_W + 40); pos[i * 3 + 2] = -HZ - 16 + (Math.random() - 0.5) * 4; }
      else { pos[i * 3] = (Math.random() - 0.5) * (FIELD_W + 40); pos[i * 3 + 2] = HZ + 16 + (Math.random() - 0.5) * 4; }
      pos[i * 3 + 1] = 4 + Math.random() * 6;
      c.setHSL(Math.random(), 0.8, 0.55);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.55, vertexColors: true })));
  }
  // vallas publicitarias
  const ads = ['⚽ FÚTBOL 3D', '★ FC MOBILE ★', '📱 ANDROID', '🏆 COPA 3D', '⚡ SPRINT', '🎮 JUEGA YA'];
  for (let i = 0; i < 16; i++) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48;
    const g2 = cv.getContext('2d');
    g2.fillStyle = i % 2 ? '#facc15' : '#0ea5e9'; g2.fillRect(0, 0, 256, 48);
    g2.fillStyle = '#111'; g2.font = 'bold 26px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText(ads[i % ads.length], 128, 26);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.4), new THREE.MeshBasicMaterial({ map: tx }));
    if (i < 8) { m.position.set(-HX - 9 + i * 5.2, 0.9, -HZ - 8); }
    else { m.position.set(-HX - 9 + (i - 8) * 5.2, 0.9, HZ + 8); m.rotation.y = Math.PI; }
    scene.add(m);
  }
  // focos
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af });
  for (const [x, z] of [[-34, -44], [34, -44], [-34, 44], [34, 44]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 26, 8), poleMat);
    p.position.set(x, 13, z); scene.add(p);
    const head = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xfff7cc }));
    head.position.set(x, 26.5, z); head.lookAt(0, 0, 0); scene.add(head);
  }
}

// ---------- Jugadores y balón ----------
const skinTones = [0xffdbac, 0xf1c27d, 0xc68642, 0x8d5524];
function makePlayer(team, idx) {
  const g = new THREE.Group();
  const shirt = team === 0 ? 0x2563eb : 0xdc2626;
  const shorts = team === 0 ? 0x172554 : 0x450a0a;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 10),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.7 }));
  body.position.y = 1.0; body.castShadow = true; g.add(body);
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.4, 10),
    new THREE.MeshStandardMaterial({ color: shorts }));
  hips.position.y = 0.42; g.add(hips);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12),
    new THREE.MeshStandardMaterial({ color: skinTones[(idx * 2 + team) % skinTones.length], roughness: 0.6 }));
  head.position.y = 1.85; head.castShadow = true; g.add(head);
  // dorsal
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
  const c2 = cv.getContext('2d'); c2.fillStyle = '#fff'; c2.font = 'bold 44px sans-serif';
  c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(String(team === 0 ? idx + 1 : idx + 1), 32, 34);
  const numTx = new THREE.CanvasTexture(cv);
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({ map: numTx, transparent: true }));
  num.position.set(0, 1.15, -0.43); num.rotation.y = Math.PI; g.add(num);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 24),
    new THREE.MeshBasicMaterial({ color: team === 0 ? 0x38bdf8 : 0xf87171, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false; g.add(ring);
  scene.add(g);
  return { mesh: g, ring };
}
const FORM0 = [[0, -31, 1], [-8, -18, 0], [8, -18, 0], [0, -6, 0], [0, 8, 0]];
const FORM1 = [[0, 31, 1], [8, 18, 0], [-8, 18, 0], [0, 6, 0], [0, -8, 0]];
const teams = [[], []];
for (let t = 0; t < 2; t++) {
  const F = t === 0 ? FORM0 : FORM1;
  for (let i = 0; i < 5; i++) {
    const { mesh, ring } = makePlayer(t, i);
    teams[t].push({
      team: t, idx: i, mesh, ring,
      p: new THREE.Vector3(F[i][0], 0, F[i][2 - 0] ?? F[i][1]),
      v: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, t === 0 ? 1 : -1),
      home: new THREE.Vector3(F[i][0], 0, F[i][1]),
      isGK: F[i][2] === 1, speed: 7, ctrl: false, tackleCD: 0, aiT: Math.random(),
    });
    teams[t][i].p.set(F[i][0], 0, F[i][1]);
    mesh.position.copy(teams[t][i].p);
  }
}
// FIX homes z (línea anterior confusa): reasignar bien
teams[0].forEach((pl, i) => { pl.home.set(FORM0[i][0], 0, FORM0[i][1]); pl.p.copy(pl.home); });
teams[1].forEach((pl, i) => { pl.home.set(FORM1[i][0], 0, FORM1[i][1]); pl.p.copy(pl.home); });

const ball = {
  mesh: new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })),
  p: new THREE.Vector3(0, 0.35, 0), v: new THREE.Vector3(),
  owner: null, lastTouch: null,
};
ball.mesh.castShadow = true; scene.add(ball.mesh);
// sombra del balón extra
const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);

// ---------- Estado ----------
const G = {
  phase: 'menu', score: [0, 0], timeLeft: OPT.minutes * 60, total: OPT.minutes * 60,
  controlled: 3, camMode: 0, // 0 follow, 1 lateral TV, 2 alta
  kickoffT: 0, goalT: 0, paused: false, sprint: false,
};
function fmtT(s) { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
function updateHUD() {
  $('score').textContent = `${G.score[0]} - ${G.score[1]}`;
  $('mtime').textContent = fmtT(G.timeLeft);
}

// ---------- Entrada: joystick + teclado ----------
const joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
const keys = {};
addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (['arrowup', 'arrowdown', ' '].includes(e.key.toLowerCase())) e.preventDefault(); });
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
const joyZone = $('joy-zone'), joyBase = $('joy-base'), joyKnob = $('joy-knob');
function joyStart(x, y, id) {
  joy.active = true; joy.id = id; joy.ox = x; joy.oy = y; joy.dx = 0; joy.dy = 0;
  joyBase.style.display = 'block'; joyBase.style.left = x + 'px'; joyBase.style.top = y + 'px';
  $('joy-hint').style.display = 'none';
}
function joyMove(x, y) {
  if (!joy.active) return;
  let dx = x - joy.ox, dy = y - joy.oy;
  const m = Math.hypot(dx, dy), max = 52;
  if (m > max) { dx = (dx / m) * max; dy = (dy / m) * max; }
  joy.dx = dx / max; joy.dy = dy / max;
  joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
function joyEnd() { joy.active = false; joy.id = null; joy.dx = joy.dy = 0; joyBase.style.display = 'none'; joyKnob.style.transform = 'translate(-50%,-50%)'; }
joyZone.addEventListener('touchstart', (e) => { audio(); const t = e.changedTouches[0]; const r = joyZone.getBoundingClientRect(); joyStart(t.clientX - r.left, t.clientY - r.top, t.identifier); e.preventDefault(); }, { passive: false });
joyZone.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) { const r = joyZone.getBoundingClientRect(); joyMove(t.clientX - r.left, t.clientY - r.top); } e.preventDefault(); }, { passive: false });
joyZone.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) joyEnd(); }, { passive: true });
joyZone.addEventListener('mousedown', (e) => { const r = joyZone.getBoundingClientRect(); joyStart(e.clientX - r.left, e.clientY - r.top, 'm'); });
addEventListener('mousemove', (e) => { if (joy.id === 'm') { const r = joyZone.getBoundingClientRect(); joyMove(e.clientX - r.left, e.clientY - r.top); } });
addEventListener('mouseup', () => { if (joy.id === 'm') joyEnd(); });

function inputVec() {
  let x = joy.dx, z = joy.dy; // pantalla: arriba = -dy = avanzar (+Z)
  if (keys['w'] || keys['arrowup']) z -= 1;
  if (keys['s'] || keys['arrowdown']) z += 1;
  if (keys['a'] || keys['arrowleft']) x -= 1;
  if (keys['d'] || keys['arrowright']) x += 1;
  const m = Math.hypot(x, z);
  if (m > 1) { x /= m; z /= m; }
  return { x, z: -z, mag: Math.min(1, m) }; // z invertido: joystick arriba => +Z (ataque)
}
const sprintHeld = () => G.sprint || keys['shift'];

// botones
function bindBtn(id, fn) {
  const el = $(id);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); audio(); fn(); }, { passive: false });
  el.addEventListener('mousedown', (e) => { e.preventDefault(); fn(); });
}
bindBtn('btn-pass', doPass);
bindBtn('btn-shoot', doShoot);
bindBtn('btn-switch', () => { cyclePlayer(); sfx.click(); });
$('btn-sprint').addEventListener('touchstart', (e) => { e.preventDefault(); toggleSprint(); }, { passive: false });
$('btn-sprint').addEventListener('mousedown', (e) => { e.preventDefault(); toggleSprint(); });
function toggleSprint() { G.sprint = !G.sprint; $('btn-sprint').id = 'btn-sprint'; $('btn-sprint').style.outline = G.sprint ? '3px solid #fff' : 'none'; sfx.click(); }
addEventListener('keydown', (e) => {
  if (G.phase !== 'playing') return;
  const k = e.key.toLowerCase();
  if (k === 'j') doPass();
  if (k === 'k') doShoot();
  if (k === 'l') cyclePlayer();
});

// ---------- Lógica de partido ----------
function myPlayer() { return teams[0][G.controlled]; }
function closestTo(team, pos, excludeGK = true) {
  let best = null, bd = 1e9;
  for (const pl of teams[team]) {
    if (excludeGK && pl.isGK) continue;
    const d = pl.p.distanceToSquared(pos);
    if (d < bd) { bd = d; best = pl; }
  }
  return best;
}
function cyclePlayer() {
  const cands = teams[0].filter((p) => !p.isGK);
  cands.sort((a, b) => a.p.distanceToSquared(ball.p) - b.p.distanceToSquared(ball.p));
  const cur = myPlayer();
  let i = cands.indexOf(cur);
  G.controlled = teams[0].indexOf(cands[(i + 1) % cands.length]);
}
function autoSwitch() {
  if (ball.owner) {
    if (ball.owner.team === 0 && !ball.owner.isGK) G.controlled = teams[0].indexOf(ball.owner);
    else if (ball.owner.team === 1) {
      const c = closestTo(0, ball.p);
      if (c) G.controlled = teams[0].indexOf(c);
    }
  } else {
    const c = closestTo(0, ball.p);
    if (c && c.p.distanceTo(ball.p) < 14) G.controlled = teams[0].indexOf(c);
  }
}
function kickBall(dir, power, lift) {
  const o = ball.owner;
  ball.owner = null;
  ball.v.set(dir.x, 0, dir.z).normalize().multiplyScalar(power);
  ball.v.y = lift;
  ball.p.y = Math.max(ball.p.y, 0.4);
  if (o) ball.lastTouch = o;
  sfx.kick();
}
function doPass() {
  if (G.phase !== 'playing' || G.paused) return;
  const me = myPlayer();
  if (ball.owner !== me) { // entrada deslizante: intentar robar
    me.tackleCD = 0.01; return;
  }
  const iv = inputVec();
  let aim = iv.mag > 0.2 ? new THREE.Vector3(iv.x, 0, iv.z) : me.dir.clone();
  let best = null, bs = -2;
  for (const mate of teams[0]) {
    if (mate === me) continue;
    const to = mate.p.clone().sub(me.p); to.y = 0;
    const d = to.length(); if (d < 0.5) continue;
    to.normalize();
    const s = to.dot(aim.clone().normalize()) - d * 0.012;
    if (s > bs) { bs = s; best = mate; }
  }
  sfx.pass();
  if (best) {
    const to = best.p.clone().sub(me.p); to.y = 0;
    const d = to.length();
    kickBall(to.normalize(), clamp(13 + d * 0.75, 15, 26), 1.2);
  } else {
    kickBall(aim, 18, 1.0);
  }
}
function doShoot() {
  if (G.phase !== 'playing' || G.paused) return;
  const me = myPlayer();
  if (ball.owner !== me) { me.tackleCD = 0.01; return; }
  const goalZ = HZ, iv = inputVec();
  const aimX = clamp(me.p.x * 0.3 + iv.x * 5, -GOAL_W / 2 + 0.6, GOAL_W / 2 - 0.6);
  const to = new THREE.Vector3(aimX - me.p.x, 0, goalZ - me.p.z);
  const d = to.length();
  const err = DIFF[OPT.difficulty].cpuShotErr; // al jugador no le afecta, tiro limpio
  to.x += (Math.random() - 0.5) * 0.6;
  kickBall(to.normalize(), clamp(20 + d * 0.55, 24, 40), clamp(2.2 + d * 0.09, 2.5, 6.5));
  void err;
}
function goalScored(team) {
  G.phase = 'goal'; G.goalT = 2.6;
  G.score[team]++;
  updateHUD(); sfx.goal();
  const f = $('goal-flash'); f.classList.remove('hidden');
  f.firstElementChild.textContent = team === 0 ? '¡GOOOOL! ⚽🔵' : 'Gol de la CPU 🔴';
  setTimeout(() => f.classList.add('hidden'), 2400);
}
function kickoff() {
  ball.p.set(0, 0.35, 0); ball.v.set(0, 0, 0); ball.owner = null;
  teams[0].forEach((pl, i) => { pl.p.copy(pl.home); pl.v.set(0, 0, 0); });
  teams[1].forEach((pl, i) => { pl.p.copy(pl.home); pl.v.set(0, 0, 0); });
  G.controlled = 3; G.kickoffT = 0.6;
}
function endMatch() {
  G.phase = 'fulltime'; sfx.whistle(3);
  const [a, b] = G.score;
  $('ft-score').textContent = `TÚ ${a} — ${b} CPU`;
  $('ft-emoji').textContent = a > b ? '🏆' : a === b ? '🤝' : '😅';
  $('ft-title').textContent = a > b ? '¡CAMPEÓN!' : a === b ? '¡EMPATE!' : 'DERROTA';
  $('ft-sub').textContent = a > b ? '¡Jugaste como un crack de FC! ¿Revancha en difícil?' : a === b ? 'Partidazo. La próxima es tuya.' : 'La CPU ganó esta vez. Ajusta la táctica y vuelve.';
  $('fulltime').classList.remove('hidden');
}
function startMatch() {
  audio(); applyQuality();
  G.score = [0, 0]; G.timeLeft = OPT.minutes * 60; G.total = OPT.minutes * 60;
  G.phase = 'playing'; G.paused = false;
  $('menu').classList.add('hidden'); $('fulltime').classList.add('hidden'); $('pause').classList.add('hidden');
  kickoff(); updateHUD(); sfx.whistle(1);
}
$('btn-play').onclick = startMatch;
$('btn-play3').onclick = startMatch;
$('btn-quit').onclick = () => { $('pause').classList.add('hidden'); $('menu').classList.remove('hidden'); G.phase = 'menu'; };
$('btn-quit2').onclick = () => { $('fulltime').classList.add('hidden'); $('menu').classList.remove('hidden'); G.phase = 'menu'; };
$('btn-pause').onclick = () => {
  if (G.phase !== 'playing') return;
  G.paused = !G.paused;
  $('pause').classList.toggle('hidden', !G.paused);
  $('pause-info').textContent = `TÚ ${G.score[0]} - ${G.score[1]} CPU · ${fmtT(G.timeLeft)}`;
};
$('btn-play2').onclick = () => { G.paused = false; $('pause').classList.add('hidden'); };
$('btn-menu').onclick = () => { G.paused = true; $('pause').classList.toggle('hidden'); };
$('btn-cam').onclick = () => { G.camMode = (G.camMode + 1) % 3; sfx.click(); $('hint-bar').textContent = ['📷 Seguimiento', '📷 Lateral TV', '📷 Alta'][G.camMode]; setTimeout(() => ($('hint-bar').textContent = 'Joystick: mover • A: pase • B: tiro • ⇄: cambiar'), 1500); };

// ---------- IA ----------
function gkUpdate(pl, dt) {
  const gz = pl.team === 0 ? -HZ : HZ;
  const dirS = pl.team === 0 ? 1 : -1;
  const targetX = clamp(ball.p.x * 0.55, -GOAL_W / 2, GOAL_W / 2);
  const targetZ = gz + dirS * 1.2 - Math.sign(gz) * 0 + (Math.abs(ball.p.z - gz) < 14 ? -dirS * 1.5 : 0);
  moveTowards(pl, targetX, clamp(targetZ, -HZ - 1, HZ + 1), 7.5, dt);
  // estirada: si balón cerca y rápido hacia portería
  if (pl.p.distanceTo(ball.p) < 2.2 && Math.abs(ball.p.z - gz) < 6 && !ball.owner) {
    ball.v.x += (ball.p.x - pl.p.x) * 4; ball.v.z += dirS * 10; ball.v.y = Math.max(ball.v.y, 3);
    ball.lastTouch = pl;
  }
  if (ball.owner === pl) { // saque del portero
    const up = new THREE.Vector3((Math.random() - 0.5) * 10, 0, dirS * 30);
    ball.owner = null; ball.v.copy(up).setY(6); ball.lastTouch = pl; sfx.kick();
  }
  // atrapar
  if (!ball.owner && ball.p.distanceToSquared(pl.p) < 1.7 && ball.v.length() < 16) {
    ball.owner = pl; ball.v.set(0, 0, 0);
  }
}
function moveTowards(pl, x, z, spd, dt) {
  const dx = x - pl.p.x, dz = z - pl.p.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) { pl.v.multiplyScalar(0.8); return; }
  const s = Math.min(spd, d * 4);
  pl.v.x = lerp(pl.v.x, (dx / d) * s, 0.25);
  pl.v.z = lerp(pl.v.z, (dz / d) * s, 0.25);
  pl.p.x += pl.v.x * dt; pl.p.z += pl.v.z * dt;
  pl.dir.set(pl.v.x, 0, pl.v.z).normalize();
}
function cpuBrain(dt) {
  const D = DIFF[OPT.difficulty];
  const mates = teams[1];
  const chase = closestTo(1, ball.owner ? ball.owner.p : ball.p, false);
  const owner = ball.owner;
  for (const pl of mates) {
    if (pl.isGK) { gkUpdate(pl, dt); continue; }
    if (owner === pl) {
      // conducir al arco del jugador (z negativo)
      pl.aiT -= dt;
      const toGoal = new THREE.Vector3(0 - pl.p.x, 0, -HZ - pl.p.z);
      const dGoal = toGoal.length();
      // pase si hay presión
      const press = teams[0].some((o) => !o.isGK && o.p.distanceTo(pl.p) < 3);
      let mate = null, bs = 0.3;
      for (const m2 of mates) {
        if (m2 === pl || m2.isGK) continue;
        if (m2.p.z < pl.p.z - 2) {
          const free = Math.min(...teams[0].map((o) => o.p.distanceTo(m2.p)));
          const s = free * 0.3 + (pl.p.distanceTo(m2.p) < 20 ? 1 : 0);
          if (s > bs) { bs = s; mate = m2; }
        }
      }
      if (press && mate && Math.random() < 0.06) {
        const to = mate.p.clone().sub(pl.p); to.y = 0;
        ball.owner = null; ball.v.copy(to.normalize().multiplyScalar(22)).setY(1.4); ball.lastTouch = pl; sfx.pass();
      } else if (dGoal < 24 && Math.abs(pl.p.x) < 16 && pl.aiT <= 0) {
        const aimX = clamp(pl.p.x * 0.3 + (Math.random() - 0.5) * D.cpuShotErr * 2, -GOAL_W / 2 + 0.5, GOAL_W / 2 - 0.5);
        const to = new THREE.Vector3(aimX - pl.p.x, 0, -HZ - pl.p.z).normalize();
        ball.owner = null; ball.v.copy(to.multiplyScalar(26 + Math.random() * 8)).setY(3 + Math.random() * 2.5); ball.lastTouch = pl; sfx.kick();
        pl.aiT = 1.2;
      } else {
        toGoal.normalize();
        // regate zigzag
        toGoal.x += Math.sin(performance.now() * 0.002 + pl.idx) * 0.35;
        moveTowards(pl, pl.p.x + toGoal.x * 6, pl.p.z + toGoal.z * 6, D.cpuSpeed, dt);
        if (!ball.owner) { /* perdió */ }
      }
      // mover balón con dueño
      if (ball.owner === pl) {
        ball.p.set(pl.p.x + pl.dir.x * 0.9, 0.35, pl.p.z + pl.dir.z * 0.9);
      }
    } else if (pl === chase) {
      const t = ball.owner && ball.owner.team === 1 ? ball.owner.p : ball.p;
      const pressT = ball.owner && ball.owner.team === 0 ? ball.owner.p : ball.p;
      moveTowards(pl, pressT.x, pressT.z, D.cpuSpeed * (ball.owner?.team === 0 ? 1 : 0.92), dt);
      void t;
      // robo
      if (ball.owner && ball.owner.team === 0 && pl.p.distanceTo(ball.owner.p) < 1.4 && Math.random() < D.tackle * dt * 2.2) {
        ball.owner = pl; ball.v.set(0, 0, 0); sfx.click();
      }
    } else {
      // volver a formación desplazada por balón
      const sx = pl.home.x * 0.75 + ball.p.x * 0.25;
      const sz = pl.home.z * 0.7 + ball.p.z * 0.3;
      // el delantero presiona salida
      const tx = pl.idx === 4 ? lerp(pl.home.x, ball.p.x, 0.4) : sx;
      const tz = pl.idx === 4 ? lerp(pl.home.z, ball.p.z, 0.35) : sz;
      moveTowards(pl, clamp(tx, -HX + 1, HX - 1), clamp(tz, -HZ + 1, HZ - 1), D.cpuSpeed * 0.75, dt);
    }
    pl.tackleCD = Math.max(0, pl.tackleCD - dt);
  }
}
function matesBrain(dt) {
  for (const pl of teams[0]) {
    if (pl.isGK) { gkUpdate(pl, dt); continue; }
    if (pl === myPlayer()) continue; // lo mueve el humano
    if (ball.owner === pl) continue; // pasa a ser controlado (autoSwitch lo hará); humano lo mueve
    // desmarque / defensa
    if (ball.owner && ball.owner.team === 0) {
      // ataque: abrirse
      const fwd = pl.home.z + 6;
      moveTowards(pl, clamp(pl.home.x * 1.1 + ball.p.x * 0.15, -HX + 1, HX - 1), clamp(fwd, -HZ + 1, HZ - 2), 6.4, dt);
    } else if (ball.owner && ball.owner.team === 1) {
      // defensa: volver + presionar el 2º más cercano
      const chase = closestTo(0, ball.p);
      if (pl === [...teams[0]].filter((p) => !p.isGK && p !== myPlayer()).sort((a, b) => a.p.distanceToSquared(ball.p) - b.p.distanceToSquared(ball.p))[0] && chase !== myPlayer()) {
        moveTowards(pl, ball.owner.p.x, ball.owner.p.z, 7.0, dt);
      } else {
        moveTowards(pl, clamp(pl.home.x * 0.8 + ball.p.x * 0.2, -HX + 1, HX - 1), clamp(pl.home.z * 0.75 + ball.p.z * 0.25, -HZ + 1, HZ - 1), 6.2, dt);
      }
    } else {
      // balón suelto: el no-controlado apoya
      moveTowards(pl, clamp(pl.home.x * 0.8 + ball.p.x * 0.2, -HX + 1, HX - 1), clamp(pl.home.z * 0.7 + ball.p.z * 0.3, -HZ + 1, HZ - 1), 6.4, dt);
    }
  }
}

// ---------- Física ----------
function physics(dt) {
  // jugador humano
  const me = myPlayer();
  if (G.phase === 'playing' && !G.paused && G.kickoffT <= 0) {
    const iv = inputVec();
    const sp = (sprintHeld() ? 10.2 : 7.4) * (ball.owner === me ? 0.92 : 1);
    me.v.x = lerp(me.v.x, iv.x * sp, 0.3);
    me.v.z = lerp(me.v.z, iv.z * sp, 0.3);
    me.p.x = clamp(me.p.x + me.v.x * dt, -HX - 2, HX + 2);
    me.p.z = clamp(me.p.z + me.v.z * dt, -HZ - 3, HZ + 3);
    if (iv.mag > 0.15) me.dir.set(iv.x, 0, iv.z).normalize();
    // entrada / robo
    if (me.tackleCD > 0) {
      me.tackleCD -= dt;
      if (ball.owner && ball.owner.team === 1 && me.p.distanceTo(ball.owner.p) < 1.7) {
        ball.owner = me; ball.v.set(0, 0, 0); sfx.click();
      }
    }
    if (ball.owner === me) ball.p.set(me.p.x + me.dir.x * 0.9, 0.35, me.p.z + me.dir.z * 0.9);
  }
  // CPU + compañeros ya movidos en brains; aplicar límites
  for (const t of [0, 1]) for (const pl of teams[t]) {
    if (t === 0 && pl === me) continue;
    if (pl.isGK) { pl.p.x = clamp(pl.p.x, -GOAL_W, GOAL_W); continue; }
    pl.p.x = clamp(pl.p.x, -HX - 2, HX + 2);
    pl.p.z = clamp(pl.p.z, -HZ - 3, HZ + 3);
    if (ball.owner === pl && pl.team === 1) { /* ya colocado */ }
    else if (ball.owner === pl) ball.p.set(pl.p.x + pl.dir.x * 0.9, 0.35, pl.p.z + pl.dir.z * 0.9);
  }
  // posesión suelta
  if (!ball.owner) {
    // roce
    const friction = ball.p.y <= 0.4 ? 1.6 : 0.25;
    ball.v.x -= ball.v.x * friction * dt;
    ball.v.z -= ball.v.z * friction * dt;
    ball.v.y -= 24 * dt;
    ball.p.addScaledVector(ball.v, dt);
    if (ball.p.y < 0.35) {
      ball.p.y = 0.35;
      if (ball.v.y < -3) { ball.v.y *= -0.55; sfx.click(); }
      else ball.v.y = 0;
      ball.v.x *= 0.92; ball.v.z *= 0.92;
    }
    // bandas: rebote arcade
    if (Math.abs(ball.p.x) > HX && Math.abs(ball.p.z) < HZ) { ball.p.x = Math.sign(ball.p.x) * HX; ball.v.x *= -0.6; }
    // fondo
    if (Math.abs(ball.p.z) > HZ + 0.5) {
      const inMouth = Math.abs(ball.p.x) < GOAL_W / 2 && ball.p.y < GOAL_H;
      if (inMouth && Math.abs(ball.p.z) > HZ + 1.2) {
        goalScored(ball.p.z > 0 ? 0 : 1); // +Z es arco CPU => gol TÚ
        ball.v.set(0, 0, 0);
        return;
      } else if (!inMouth) {
        // saque automático
        ball.p.z = Math.sign(ball.p.z) * (HZ - 1.5);
        ball.p.x = clamp(ball.p.x, -HX + 2, HX - 2);
        ball.v.set(0, 0, 0);
        const t = ball.p.z > 0 ? 0 : 1; // si sale por arriba, saca el de abajo...
        const k = closestTo(t === 0 ? 1 : 0, ball.p, false);
        if (k) { ball.owner = k; }
      }
    }
    ball.p.x = clamp(ball.p.x, -HX - 3, HX + 3);
    ball.p.z = clamp(ball.p.z, -HZ - 4, HZ + 4);
    // recoger
    if (G.kickoffT <= 0) {
      for (const t of [0, 1]) for (const pl of teams[t]) {
        if (ball.owner) break;
        if (ball.p.y < 1.2 && pl.p.distanceTo(ball.p) < (pl.isGK ? 1.3 : 1.05) && ball.v.length() < 14) {
          // portero rival no regala: ok
          ball.owner = pl; ball.v.set(0, 0, 0);
          if (pl.team === 1 && pl.isGK) { /* la despeja en su brain */ }
        }
      }
    }
    // rodar visual
    ball.mesh.rotation.x += ball.v.z * dt * 2;
    ball.mesh.rotation.z -= ball.v.x * dt * 2;
  } else {
    ball.v.set(0, 0, 0);
    ball.p.y = lerp(ball.p.y, 0.35, 0.4);
  }
  ball.mesh.position.copy(ball.p);
  ballShadow.position.set(ball.p.x, 0.021, ball.p.z);
  ballShadow.material.opacity = clamp(0.3 - ball.p.y * 0.04, 0.05, 0.3);
  const s = clamp(1 - ball.p.y * 0.03, 0.5, 1);
  ballShadow.scale.set(s, s, 1);
  // animación jugadores: orientación + bote al correr
  const t = performance.now() * 0.001;
  for (const tm of teams) for (const pl of tm) {
    pl.mesh.position.copy(pl.p);
    if (pl.v.lengthSq() > 0.3 || pl === me) {
      const target = Math.atan2(pl.dir.x, pl.dir.z);
      let cur = pl.mesh.rotation.y;
      let d = target - cur;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      pl.mesh.rotation.y = cur + d * 0.25;
    }
    pl.mesh.position.y = Math.abs(Math.sin(t * 9 + pl.idx)) * clamp(pl.v.length() * 0.012, 0, 0.09);
  }
  teams[0].forEach((p) => (p.ring.visible = false));
  myPlayer().ring.visible = G.phase === 'playing';
  const cpuStar = closestTo(1, ball.p, false);
  if (cpuStar) cpuStar.ring.visible = false;
}

// ---------- Cámara ----------
const camTarget = new THREE.Vector3(), camPos = new THREE.Vector3(0, 26, -30);
function updateCamera(dt) {
  const bp = ball.p, mp = myPlayer().p;
  if (G.camMode === 0) {
    camTarget.set(lerp(mp.x, bp.x, 0.65), 0, lerp(mp.z, bp.z, 0.65));
    const want = new THREE.Vector3(camTarget.x * 0.55, 24, camTarget.z - 23);
    camPos.lerp(want, 1 - Math.pow(0.001, dt));
    camera.position.copy(camPos);
    camera.lookAt(camTarget.x, 1, camTarget.z + 5);
  } else if (G.camMode === 1) {
    camTarget.set(bp.x, 0, bp.z);
    const want = new THREE.Vector3(bp.x * 0.4 + 34, 15, bp.z * 0.35);
    camPos.lerp(want, 1 - Math.pow(0.001, dt));
    camera.position.copy(camPos);
    camera.lookAt(bp.x, 1, bp.z);
  } else {
    camTarget.set(bp.x * 0.4, 0, bp.z * 0.4);
    const want = new THREE.Vector3(0, 52, -14);
    camPos.lerp(want, 1 - Math.pow(0.01, dt));
    camera.position.copy(camPos);
    camera.lookAt(0, 0, 4);
  }
}

// ---------- Bucle ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.phase === 'playing' && !G.paused) {
    if (G.kickoffT > 0) G.kickoffT -= dt;
    if (G.goalT > 0 || G.phase === 'goal') { /* handled below */ }
    if (G.phase === 'playing') {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0) { G.timeLeft = 0; updateHUD(); endMatch(); }
      else {
        cpuBrain(dt); matesBrain(dt); physics(dt); autoSwitch();
        if (Math.floor(now / 500) !== Math.floor((now - dt * 1000) / 500)) updateHUD();
      }
    }
  }
  if (G.phase === 'goal') {
    G.goalT -= dt;
    physics(dt * 0.25);
    if (G.goalT <= 0) { G.phase = 'playing'; kickoff(); }
  }
  if (G.phase === 'menu') { // demo de fondo
    const t = now * 0.0002;
    ball.p.set(Math.sin(t * 3) * 10, 0.35, Math.cos(t * 2) * 14);
    ball.mesh.position.copy(ball.p);
    for (const tm of teams) for (const pl of tm) { pl.mesh.position.copy(pl.p); pl.mesh.rotation.y += dt * 0.3; }
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}
updateHUD();
kickoff();
$('loading').style.display = 'none';
requestAnimationFrame(loop);

// PWA: instalar como app en Android
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    const sw = `self.addEventListener('fetch',e=>{});`;
    const blob = new Blob([sw], { type: 'text/javascript' });
    // no registramos SW externo para no romper file:// ; el manifest basta para "Instalar app"
  });
}
