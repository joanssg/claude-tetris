'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // WILD - comodín (se dibuja arcoíris)
];

const WILD = 8;
const SPECIAL_EVERY = 5;
const FREEZE_MS = 5000;
const SPECIALS = {
  bomb:      { icon: '💣', color: '#ef5350' },
  lightning: { icon: '⚡', color: '#ffee58' },
  tint:      { icon: '🎨', color: '#ab47bc' },
  gravity:   { icon: '⬇️', color: '#66bb6a' },
  freeze:    { icon: '❄️', color: '#4fc3f7' },
};
const SPECIAL_TYPES = Object.keys(SPECIALS);

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600];
const B2B_MULT = 1.5;
const PC_BONUS = 1600;
const MAX_COMBO = 10;
const LINE_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const freezeEl = document.getElementById('freeze');
const comboEl = document.getElementById('combo');
const b2bEl = document.getElementById('b2b');
const bannerEl = document.getElementById('banner');
const gameContainer = document.querySelector('.game-container');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let specialsGiven, pendingSpecial, freezeLeft;
let combo, b2b, lastMoveRotate, particles = [];

// ---- Audio (WebAudio, sin assets) ----
let audioCtx = null;
let muted = false;
try { muted = localStorage.getItem('tetris-muted') === '1'; } catch (e) {}

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq, start, dur, type = 'square', vol = 0.08) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

function playSfx(kind, n = 1) {
  if (muted || !audioCtx) return;
  switch (kind) {
    case 'clear': {
      const f = 440 * Math.pow(2, Math.min(n - 1, 12) / 12 * 2);
      tone(f, 0, 0.12);
      tone(f * 1.5, 0.07, 0.14);
      break;
    }
    case 'tetris':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.06, 0.15, 'triangle', 0.1));
      break;
    case 'tspin':
      [392, 587, 784].forEach((f, i) => tone(f, i * 0.07, 0.16, 'sawtooth', 0.06));
      break;
    case 'perfect':
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.08, 0.25, 'triangle', 0.1));
      break;
    case 'break':
      tone(200, 0, 0.18, 'sawtooth', 0.05);
      tone(140, 0.08, 0.2, 'sawtooth', 0.05);
      break;
  }
}

// ---- Efectos visuales ----
let bannerTimer = null;

function showBanner(lines_, cls = '') {
  bannerEl.innerHTML = lines_.map(t => `<div>${t}</div>`).join('');
  bannerEl.className = 'banner ' + cls;
  void bannerEl.offsetWidth; // reinicia la animación
  bannerEl.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => bannerEl.classList.remove('show'), 1400);
}

function shake() {
  gameContainer.classList.remove('shake');
  void gameContainer.offsetWidth;
  gameContainer.classList.add('shake');
}

function spawnParticles(rows, amount) {
  for (const r of rows) {
    for (let i = 0; i < amount; i++) {
      particles.push({
        x: Math.random() * COLS * BLOCK,
        y: r * BLOCK + BLOCK / 2,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.8) * 5,
        life: 1,
        color: COLORS[Math.floor(Math.random() * 7) + 1],
      });
    }
  }
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.25;
    p.life -= 0.025;
  }
  particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function specialPiece() {
  const special = SPECIAL_TYPES[Math.floor(Math.random() * SPECIAL_TYPES.length)];
  return { type: 0, special, shape: [[1]], x: Math.floor(COLS / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastMoveRotate = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// T-spin: T con última acción = rotación y 3+ esquinas del centro ocupadas
function isTSpin() {
  if (current.special || current.type !== 3 || !lastMoveRotate) return false;
  const cx = current.x + 1, cy = current.y + 1;
  let filled = 0;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) filled++;
  }
  return filled >= 3;
}

function clearLines(tspin = false) {
  let cleared = 0, wilds = 0;
  const clearedRows = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      wilds += board[r].filter(v => v === WILD).length;
      clearedRows.push(r + cleared);
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (!cleared && !tspin) {
    if (combo > 1) playSfx('break');
    combo = 0;
    return;
  }
  if (!cleared) {
    // T-spin sin líneas: puntos, sin tocar combo ni B2B
    score += TSPIN_SCORES[0] * level;
    showBanner(['T-SPIN'], 'tspin');
    playSfx('tspin');
    updateHUD();
    return;
  }
  if (cleared) {
    lines += cleared;
    combo++;
    const hard = tspin || cleared === 4;
    const useB2B = hard && b2b;
    b2b = hard;
    let base = (tspin ? TSPIN_SCORES[Math.min(cleared, 3)] : LINE_SCORES[cleared]) * level;
    if (useB2B) base = Math.floor(base * B2B_MULT);
    base *= Math.min(combo, MAX_COMBO);
    const perfect = board.every(row => row.every(v => v === 0));
    score += base + wilds * 50 * level + (perfect ? PC_BONUS * level : 0);

    // feedback
    const banner = [];
    if (tspin) banner.push(`T-SPIN ${LINE_NAMES[cleared]}`);
    else if (cleared === 4) banner.push('TETRIS');
    if (useB2B) banner.push('BACK-TO-BACK');
    if (combo >= 2) banner.push(`COMBO x${Math.min(combo, MAX_COMBO)}`);
    if (perfect) banner.push('PERFECT CLEAR');
    if (banner.length) showBanner(banner, perfect ? 'perfect' : tspin ? 'tspin' : '');
    spawnParticles(clearedRows, 6 + Math.min(combo, MAX_COMBO) * 2);
    if (perfect) { playSfx('perfect'); shake(); }
    else if (tspin) playSfx('tspin');
    else if (cleared === 4) { playSfx('tetris'); shake(); }
    else playSfx('clear', combo);

    if (Math.floor(lines / SPECIAL_EVERY) > specialsGiven) {
      specialsGiven = Math.floor(lines / SPECIAL_EVERY);
      pendingSpecial = true;
    }
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  if (gy !== current.y) lastMoveRotate = false;
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function applySpecial(type, x, y) {
  switch (type) {
    case 'bomb':
      for (let r = y - 1; r <= y + 1; r++)
        for (let c = x - 1; c <= x + 1; c++)
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
      break;
    case 'lightning':
      if (Math.random() < 0.5) board[y].fill(0);
      else for (let r = 0; r < ROWS; r++) board[r][x] = 0;
      score += 100 * level;
      break;
    case 'tint': {
      let target = y + 1 < ROWS ? board[y + 1][x] : 0;
      if (!target || target === WILD) {
        const counts = {};
        for (const row of board)
          for (const v of row) if (v && v !== WILD) counts[v] = (counts[v] || 0) + 1;
        target = +Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 0;
      }
      if (target)
        for (const row of board)
          for (let c = 0; c < COLS; c++) if (row[c] === target) row[c] = WILD;
      break;
    }
    case 'gravity':
      for (let c = 0; c < COLS; c++) {
        const col = [];
        for (let r = 0; r < ROWS; r++) if (board[r][c]) col.push(board[r][c]);
        for (let r = ROWS - 1; r >= 0; r--) board[r][c] = col.pop() || 0;
      }
      break;
    case 'freeze':
      freezeLeft = FREEZE_MS;
      break;
  }
  updateHUD();
}

function lockPiece() {
  let tspin = false;
  if (current.special) applySpecial(current.special, current.x, current.y);
  else {
    tspin = isTSpin();
    merge();
  }
  clearLines(tspin);
  lastMoveRotate = false;
  spawn();
}

function spawn() {
  current = next;
  if (pendingSpecial) {
    next = specialPiece();
    pendingSpecial = false;
  } else {
    next = randomPiece();
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  freezeEl.textContent = freezeLeft > 0 ? `❄️ ${Math.ceil(freezeLeft / 1000)}s` : '';
  freezeEl.classList.toggle('hidden', !(freezeLeft > 0));
  comboEl.textContent = combo >= 2 ? `x${Math.min(combo, MAX_COMBO)}` : '-';
  comboEl.classList.toggle('active', combo >= 2);
  b2bEl.textContent = b2b ? 'ON' : '-';
  b2bEl.classList.toggle('active', !!b2b);
}

function drawSpecial(context, x, y, special, size, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = SPECIALS[special].color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.font = `${Math.floor(size * 0.6)}px serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#000';
  context.fillText(SPECIALS[special].icon, x * size + size / 2, y * size + size / 2 + 1);
  context.globalAlpha = 1;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  let color = COLORS[colorIndex];
  if (colorIndex === WILD) {
    const g = context.createLinearGradient(x * size, y * size, (x + 1) * size, (y + 1) * size);
    ['#ef5350', '#ffd54f', '#81c784', '#4fc3f7', '#ba68c8'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    color = g;
  }
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid');
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) {
        if (current.special) drawSpecial(ctx, current.x + c, gy + r, current.special, BLOCK, 0.2);
        else drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
      }

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.special && current.shape[r][c])
        drawSpecial(ctx, current.x + c, current.y + r, current.special, BLOCK);
      else drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  drawParticles();
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (next.special && shape[r][c]) drawSpecial(nextCtx, offX + c, offY + r, next.special, NB);
      else drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    updateHUD();
  } else {
    dropAccum += dt;
  }
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveRotate = false;
    } else {
      lockPiece();
    }
  }
  updateParticles();
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  specialsGiven = 0;
  pendingSpecial = false;
  freezeLeft = 0;
  combo = 0;
  b2b = false;
  lastMoveRotate = false;
  particles = [];
  bannerEl.classList.remove('show');
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

const themeToggle = document.getElementById('theme-toggle');

themeToggle.addEventListener('click', () => {
  const light = document.documentElement.dataset.theme !== 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  themeToggle.setAttribute('aria-pressed', light);
  themeToggle.textContent = light ? '🌙' : '☀️';
  themeToggle.blur();
  draw();
  drawNext();
});

document.addEventListener('keydown', e => {
  ensureAudio();
  if (e.code === 'KeyM') {
    muted = !muted;
    try { localStorage.setItem('tetris-muted', muted ? '1' : '0'); } catch (err) {}
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastMoveRotate = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastMoveRotate = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

init();
