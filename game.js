'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const DIFFICULTY = {
  easy:   { speed: 0.6,  spawnRate: 3500, maxWords: 4,  wordList: 'easy',   lives: 5, minLen: 2, maxLen: 4 },
  medium: { speed: 1.1,  spawnRate: 2800, maxWords: 6,  wordList: 'medium', lives: 4, minLen: 4, maxLen: 7 },
  hard:   { speed: 1.7,  spawnRate: 2000, maxWords: 8,  wordList: 'hard',   lives: 3, minLen: 6, maxLen: 12 },
};

const LEVEL_THRESHOLDS = [0, 500, 1200, 2200, 3500, 5200, 7500, 10500, 14500, 20000];
const COLORS = ['#4fc3f7','#81d4fa','#b3e5fc','#80deea','#a5d6a7','#fff176','#ffcc80','#ef9a9a','#ce93d8'];

// ── State ────────────────────────────────────────────────────────────────────
let canvas, ctx;
let gameState = 'menu'; // menu | playing | paused | gameover
let selectedDiff = 'easy';
let diff;

let words = [];        // falling word objects
let typed = '';        // current typed string
let score = 0;
let lives = 3;
let level = 1;
let combo = 0;
let maxCombo = 0;
let wordsTyped = 0;
let keyPresses = 0;
let correctKeys = 0;
let spawnTimer = 0;
let lastTime = 0;
let animId = null;
let practiceActive = false;
let practiceWord = '';
let practiceWords = 0;
let practiceErrors = 0;
let practiceStartTime = 0;

// Particles
let particles = [];

// Tux position
let tuxX = 0, tuxY = 0;
let tuxAnim = 0; // 0=idle, bounce frames
let tuxCatch = 0; // catch animation timer

// ── Util ─────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const rand = (a, b) => Math.random() * (b - a) + a;
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[randInt(0, arr.length - 1)];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function wordPool() {
  return WORD_LISTS[diff.wordList];
}

function getLevel(s) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (s >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function speedForLevel(base) {
  return base * (1 + (level - 1) * 0.12);
}

// ── High Scores ──────────────────────────────────────────────────────────────
function loadScores() {
  try { return JSON.parse(localStorage.getItem('tuxtyping_scores') || '[]'); } catch { return []; }
}
function saveScore(name, s, diff2) {
  const scores = loadScores();
  scores.push({ name, score: s, diff: diff2, date: Date.now() });
  scores.sort((a, b) => b.score - a.score);
  scores.splice(10);
  localStorage.setItem('tuxtyping_scores', JSON.stringify(scores));
  return scores;
}
function renderMenuScores() {
  const scores = loadScores().slice(0, 5);
  const ol = $('menu-scores');
  if (!scores.length) { ol.innerHTML = '<li style="color:#546e7a;font-size:.85rem;justify-content:center">No scores yet — play first!</li>'; return; }
  ol.innerHTML = scores.map((s, i) => `
    <li>
      <span class="hs-rank">${['🥇','🥈','🥉','4.','5.'][i]}</span>
      <span class="hs-name">${escHtml(s.name)}</span>
      <span class="hs-score">${s.score.toLocaleString()}</span>
    </li>`).join('');
}
function escHtml(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Stars background ─────────────────────────────────────────────────────────
function initStars() {
  const container = $('stars');
  container.innerHTML = '';
  for (let i = 0; i < 120; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = rand(1, 3);
    s.style.cssText = `
      width:${size}px; height:${size}px;
      left:${rand(0,100)}%; top:${rand(0,100)}%;
      --dur:${rand(2,6)}s; --op:${rand(0.2,0.9)};
      animation-delay:${rand(0,4)}s;
    `;
    container.appendChild(s);
  }
}

// ── Screen Management ────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ── Canvas Setup ─────────────────────────────────────────────────────────────
function initCanvas() {
  canvas = $('game-canvas');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  tuxX = canvas.width / 2;
  tuxY = canvas.height - 60;
}

// ── Word Objects ─────────────────────────────────────────────────────────────
function createWord() {
  const pool = wordPool();
  const usedWords = new Set(words.map(w => w.text));
  let text, attempts = 0;
  do {
    text = pick(pool).toLowerCase();
    attempts++;
  } while (usedWords.has(text) && attempts < 30);

  const margin = 80;
  const x = rand(margin, canvas.width - margin);
  const color = COLORS[randInt(0, COLORS.length - 1)];

  return {
    text,
    x,
    y: -24,
    speed: speedForLevel(diff.speed) * rand(0.85, 1.15),
    color,
    highlighted: 0, // how many chars are typed/matched
    matched: false,
    exploding: false,
    explodeTimer: 0,
    shake: 0,
  };
}

function spawnWord() {
  if (words.filter(w => !w.exploding).length < diff.maxWords) {
    words.push(createWord());
  }
}

// ── Particles ────────────────────────────────────────────────────────────────
function spawnParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.3, 0.3);
    const speed = rand(2, 7);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: rand(0.025, 0.055),
      size: rand(3, 8),
      color,
    });
  }
}

function spawnTextPop(x, y, text, color) {
  particles.push({
    type: 'text', x, y, text, color,
    vy: -1.5, life: 1, decay: 0.03,
  });
}

// ── Draw Tux ─────────────────────────────────────────────────────────────────
function drawTux(x, y, catching) {
  const c = ctx;
  c.save();
  c.translate(x, y);

  // bob animation
  const bob = Math.sin(Date.now() / 400) * 2;
  c.translate(0, bob);

  const scale = catching ? 1.08 : 1;
  c.scale(scale, scale);

  // body
  c.beginPath();
  c.ellipse(0, 0, 18, 26, 0, 0, Math.PI * 2);
  c.fillStyle = '#1a1a2e';
  c.fill();

  // white belly
  c.beginPath();
  c.ellipse(0, 5, 11, 16, 0, 0, Math.PI * 2);
  c.fillStyle = '#f5f5f5';
  c.fill();

  // eyes
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(-6, -10, 4.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(6, -10, 4.5, 0, Math.PI * 2); c.fill();

  c.fillStyle = '#111';
  c.beginPath(); c.arc(-5.5, -10, 2.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(6.5, -10, 2.5, 0, Math.PI * 2); c.fill();

  // beak
  c.beginPath();
  c.moveTo(-5, -5); c.lineTo(5, -5); c.lineTo(0, 0); c.closePath();
  c.fillStyle = '#ff8f00';
  c.fill();

  // feet
  c.fillStyle = '#ff8f00';
  c.beginPath(); c.ellipse(-8, 24, 7, 4, -0.3, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(8, 24, 7, 4, 0.3, 0, Math.PI * 2); c.fill();

  // wings / arms
  const waveL = catching ? -0.6 : Math.sin(Date.now() / 600) * 0.15;
  const waveR = catching ?  0.6 : Math.sin(Date.now() / 600 + Math.PI) * 0.15;

  c.save();
  c.translate(-18, -2);
  c.rotate(waveL);
  c.beginPath(); c.ellipse(0, 0, 6, 14, 0, 0, Math.PI * 2);
  c.fillStyle = '#1a1a2e'; c.fill();
  c.restore();

  c.save();
  c.translate(18, -2);
  c.rotate(waveR);
  c.beginPath(); c.ellipse(0, 0, 6, 14, 0, 0, Math.PI * 2);
  c.fillStyle = '#1a1a2e'; c.fill();
  c.restore();

  // catch effect
  if (catching) {
    c.beginPath();
    c.arc(0, 0, 32, 0, Math.PI * 2);
    c.strokeStyle = `rgba(129,212,250,${0.3 * (tuxCatch / 15)})`;
    c.lineWidth = 3;
    c.stroke();
  }

  c.restore();
}

// ── Draw Scene ───────────────────────────────────────────────────────────────
function drawBackground() {
  const c = ctx;
  const w = canvas.width, h = canvas.height;

  // sky gradient
  const grad = c.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#050a14');
  grad.addColorStop(0.7, '#0a1628');
  grad.addColorStop(1, '#0d2040');
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);

  // aurora effect
  const t = Date.now() / 3000;
  for (let i = 0; i < 3; i++) {
    const gx = c.createLinearGradient(0, h * 0.3, 0, h * 0.6);
    gx.addColorStop(0, 'transparent');
    gx.addColorStop(0.5, `rgba(${[0,150,136,0.04+i*0.01][0]},${[0,150,136,0.04][1]},${[0,150,136,0.04][2]},${0.03+Math.sin(t+i)*0.02})`);
    gx.addColorStop(1, 'transparent');
    c.fillStyle = gx;
    c.fillRect(i * (w / 3), 0, w / 3, h);
  }

  // ground line
  c.beginPath();
  c.moveTo(0, h - 30);
  c.lineTo(w, h - 30);
  c.strokeStyle = 'rgba(79,195,247,0.15)';
  c.lineWidth = 1;
  c.stroke();

  // snow ground
  const sg = c.createLinearGradient(0, h - 30, 0, h);
  sg.addColorStop(0, 'rgba(180,220,255,0.1)');
  sg.addColorStop(1, 'rgba(100,150,200,0.05)');
  c.fillStyle = sg;
  c.fillRect(0, h - 30, w, 30);
}

function drawWords() {
  const c = ctx;
  c.textBaseline = 'middle';
  c.textAlign = 'center';

  for (const w of words) {
    if (w.exploding) continue;

    const shake = w.shake > 0 ? rand(-w.shake, w.shake) : 0;
    const sx = w.x + shake;
    const sy = w.y + shake;

    // shadow/glow
    c.shadowColor = w.color;
    c.shadowBlur = w.highlighted > 0 ? 14 : 6;

    // background pill
    c.font = 'bold 20px "Courier New", monospace';
    const tw = c.measureText(w.text).width;
    const pad = 10, ph = 30;
    const rx = sx - tw / 2 - pad, ry = sy - ph / 2;
    c.fillStyle = 'rgba(10,14,26,0.75)';
    roundRect(c, rx, ry, tw + pad * 2, ph, 6);
    c.fill();

    // border
    c.strokeStyle = w.highlighted > 0
      ? `rgba(${hexToRgb(w.color)},0.8)`
      : 'rgba(255,255,255,0.1)';
    c.lineWidth = w.highlighted > 0 ? 2 : 1;
    c.stroke();

    c.shadowBlur = 0;

    // typed portion (bright)
    const typed2 = w.text.slice(0, w.highlighted);
    const remaining = w.text.slice(w.highlighted);

    c.fillStyle = w.color;
    c.font = 'bold 20px "Courier New", monospace';
    const typedW = c.measureText(typed2).width;
    const totalW = c.measureText(w.text).width;
    const startX = sx - totalW / 2;

    // typed chars
    if (typed2) {
      c.fillStyle = '#ffffff';
      c.textAlign = 'left';
      c.fillText(typed2, startX, sy);
    }

    // remaining chars
    c.fillStyle = w.color;
    c.textAlign = 'left';
    c.fillText(remaining, startX + typedW, sy);

    c.textAlign = 'center';

    if (w.shake > 0) w.shake *= 0.7;
  }
}

function drawParticles() {
  const c = ctx;
  for (const p of particles) {
    c.globalAlpha = p.life;
    if (p.type === 'text') {
      c.font = 'bold 22px sans-serif';
      c.fillStyle = p.color;
      c.textAlign = 'center';
      c.fillText(p.text, p.x, p.y);
    } else {
      c.fillStyle = p.color;
      c.shadowColor = p.color;
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    }
  }
  c.globalAlpha = 1;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ── Game Loop ────────────────────────────────────────────────────────────────
function gameLoop(ts) {
  if (gameState !== 'playing') return;
  animId = requestAnimationFrame(gameLoop);

  const dt = Math.min((ts - lastTime) / 16.67, 3); // capped delta in frames
  lastTime = ts;

  spawnTimer -= dt * 16.67;
  if (spawnTimer <= 0) {
    spawnWord();
    spawnTimer = diff.spawnRate / (1 + (level - 1) * 0.08);
  }

  // Move words
  for (const w of words) {
    if (w.exploding) {
      w.explodeTimer -= dt;
      if (w.explodeTimer <= 0) w._remove = true;
      continue;
    }
    w.y += w.speed * dt;

    // hit ground
    if (w.y > canvas.height - 35) {
      loseLife(w);
      w._remove = true;
    }
  }
  words = words.filter(w => !w._remove);

  // Update particles
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (!p.type) { p.vy += 0.15; p.vx *= 0.97; }
    p.life -= p.decay;
  }
  particles = particles.filter(p => p.life > 0);

  // Tux catch timer
  if (tuxCatch > 0) tuxCatch--;

  // Check typing match
  updateHighlights();

  // Draw
  drawBackground();
  drawWords();
  drawParticles();
  const catching = tuxCatch > 0;
  drawTux(tuxX, tuxY, catching);

  // Level up check
  const newLevel = Math.min(getLevel(score), LEVEL_THRESHOLDS.length);
  if (newLevel > level) {
    level = newLevel;
    $('hud-level').textContent = level;
    spawnTextPop(canvas.width / 2, canvas.height / 2, `Level ${level}!`, '#ffca28');
    spawnParticles(canvas.width / 2, canvas.height / 2, '#ffca28', 20);
  }
}

function updateHighlights() {
  let anyMatch = false;
  for (const w of words) {
    if (w.exploding) continue;
    if (typed && w.text.startsWith(typed)) {
      w.highlighted = typed.length;
      anyMatch = true;
    } else {
      w.highlighted = 0;
    }
  }

  // Move tux toward matched word
  const matched = words.find(w => !w.exploding && w.highlighted > 0);
  if (matched) {
    tuxX += (matched.x - tuxX) * 0.08;
  } else {
    tuxX += (canvas.width / 2 - tuxX) * 0.04;
  }
}

function submitTyped() {
  if (!typed) return;
  const match = words.find(w => !w.exploding && w.text === typed);
  if (match) {
    destroyWord(match);
  } else {
    // wrong word — shake all visible words
    words.forEach(w => { if (!w.exploding) w.shake = 4; });
    combo = 0;
    updateComboDisplay();
  }
  typed = '';
  $('input-display').textContent = '';
}

function destroyWord(w) {
  w.exploding = true;
  w.explodeTimer = 15;
  tuxCatch = 18;

  const pts = wordScore(w.text.length);
  score += pts;
  wordsTyped++;
  combo++;
  if (combo > maxCombo) maxCombo = combo;

  spawnParticles(w.x, w.y, w.color, 14);
  spawnTextPop(w.x, w.y - 20, `+${pts}`, w.color);
  if (combo >= 3) spawnTextPop(w.x, w.y - 45, `${combo}x COMBO!`, '#ffca28');

  $('hud-score').textContent = score.toLocaleString();
  updateComboDisplay();
}

function wordScore(len) {
  const base = len * 10;
  const comboBonus = Math.min(combo, 10) * 5;
  const levelBonus = (level - 1) * 3;
  return base + comboBonus + levelBonus;
}

function loseLife(w) {
  lives--;
  combo = 0;
  updateComboDisplay();
  spawnParticles(w.x, canvas.height - 35, '#ff5252', 8);

  const lifeStr = '❤️'.repeat(Math.max(lives, 0)) + '🖤'.repeat(Math.max(0, diff.lives - lives));
  $('hud-lives').textContent = lifeStr || '💀';

  if (lives <= 0) {
    endGame();
  }
}

function updateComboDisplay() {
  const el = $('combo-display');
  if (combo >= 3) {
    el.textContent = `${combo}x COMBO`;
    el.classList.add('show');
  } else {
    el.classList.remove('show');
  }
}

// ── Start / End ──────────────────────────────────────────────────────────────
function startGame() {
  diff = DIFFICULTY[selectedDiff];
  words = [];
  particles = [];
  typed = '';
  score = 0;
  lives = diff.lives;
  level = 1;
  combo = 0;
  maxCombo = 0;
  wordsTyped = 0;
  keyPresses = 0;
  correctKeys = 0;
  spawnTimer = 0;
  tuxCatch = 0;

  $('hud-score').textContent = '0';
  $('hud-level').textContent = '1';
  $('hud-lives').textContent = '❤️'.repeat(lives);
  $('input-display').textContent = '';
  $('combo-display').classList.remove('show');

  gameState = 'playing';
  showScreen('screen-game');
  resize();

  lastTime = performance.now();
  animId = requestAnimationFrame(gameLoop);
}

function endGame() {
  gameState = 'gameover';
  cancelAnimationFrame(animId);

  const won = false; // could add win condition later
  $('result-icon').textContent = lives > 0 ? '🏆' : '💀';
  $('gameover-title').textContent = lives > 0 ? 'You Win!' : 'Game Over';
  $('final-score').textContent = score.toLocaleString();
  $('final-words').textContent = wordsTyped;
  $('final-accuracy').textContent = keyPresses > 0 ? `${Math.round(correctKeys / keyPresses * 100)}%` : '—';
  $('final-combo').textContent = maxCombo;

  // Check high score
  const scores = loadScores();
  const isHigh = !scores.length || score > scores[scores.length - 1]?.score || scores.length < 10;
  $('new-highscore-badge').classList.toggle('hidden', !isHigh || score === 0);

  showScreen('screen-gameover');
  $('screen-game').classList.add('active'); // keep canvas visible behind overlay
}

// ── Input Handling ───────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (gameState !== 'playing') return;

  if (e.key === 'Escape') { pauseGame(); return; }
  if (e.key === 'Backspace') {
    if (typed.length > 0) {
      typed = typed.slice(0, -1);
      $('input-display').textContent = typed;
    }
    return;
  }
  if (e.key === 'Enter') { submitTyped(); return; }

  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    const ch = e.key.toLowerCase();
    keyPresses++;

    // check if this char advances any word
    const potential = words.find(w => !w.exploding && w.text.startsWith(typed + ch));
    if (potential) correctKeys++;

    typed += ch;
    $('input-display').textContent = typed;

    // auto-complete if exact match
    const exact = words.find(w => !w.exploding && w.text === typed);
    if (exact) { submitTyped(); }
  }
});

function pauseGame() {
  gameState = 'paused';
  cancelAnimationFrame(animId);
  showScreen('screen-pause');
  $('screen-game').classList.add('active');
}

function resumeGame() {
  gameState = 'playing';
  lastTime = performance.now();
  animId = requestAnimationFrame(gameLoop);
  $('screen-pause').classList.remove('active');
}

// ── Practice Mode ────────────────────────────────────────────────────────────
let practiceQueue = [];
let practiceIdx = 0;
let practiceTotalChars = 0;
let practiceErrorCount = 0;
let practiceWordCount = 0;

function startPractice() {
  practiceActive = true;
  practiceQueue = shuffle(ALL_WORDS);
  practiceIdx = 0;
  practiceTotalChars = 0;
  practiceErrorCount = 0;
  practiceWordCount = 0;
  practiceStartTime = Date.now();
  $('pstat-words').textContent = '0';
  $('pstat-wpm').textContent = '0';
  $('pstat-acc').textContent = '100%';
  showScreen('screen-practice');
  nextPracticeWord();
  $('practice-input').focus();
}

function nextPracticeWord() {
  if (practiceIdx >= practiceQueue.length) practiceQueue = shuffle(ALL_WORDS), practiceIdx = 0;
  practiceWord = practiceQueue[practiceIdx++];
  renderPracticeWord('', false);
  $('practice-input').value = '';
  $('practice-input').className = '';
  // rebuild progress bar
  let bar = $('practice-progress-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'practice-progress-bar';
    $('practice-progress').appendChild(bar);
  }
  bar.style.width = '0%';
}

function renderPracticeWord(typedSoFar, hasError) {
  const el = $('practice-word');
  let html = '';
  for (let i = 0; i < practiceWord.length; i++) {
    if (i < typedSoFar.length) {
      const ok = typedSoFar[i] === practiceWord[i];
      html += `<span class="${ok ? 'typed' : 'error'}">${practiceWord[i]}</span>`;
    } else {
      html += `<span class="remaining">${practiceWord[i]}</span>`;
    }
  }
  el.innerHTML = html;

  const pct = Math.min(typedSoFar.length / practiceWord.length * 100, 100);
  const bar = $('practice-progress-bar');
  if (bar) bar.style.width = pct + '%';
}

$('practice-input').addEventListener('input', e => {
  if (!practiceActive) return;
  const val = e.target.value;

  // detect if correct so far
  const prefix = practiceWord.slice(0, val.length);
  const correct = val === prefix;

  $('practice-input').className = val.length === 0 ? '' : correct ? 'correct' : 'wrong';
  renderPracticeWord(val, !correct);

  if (val === practiceWord) {
    // word completed
    practiceWordCount++;
    practiceTotalChars += practiceWord.length;
    $('pstat-words').textContent = practiceWordCount;

    const elapsed = (Date.now() - practiceStartTime) / 60000;
    const wpm = elapsed > 0 ? Math.round((practiceTotalChars / 5) / elapsed) : 0;
    $('pstat-wpm').textContent = wpm;

    const totalKeystrokes = practiceTotalChars + practiceErrorCount;
    const acc = totalKeystrokes > 0 ? Math.round(practiceTotalChars / totalKeystrokes * 100) : 100;
    $('pstat-acc').textContent = acc + '%';

    setTimeout(nextPracticeWord, 150);
  }
});

$('practice-input').addEventListener('keydown', e => {
  if (!practiceActive) return;
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    const val = $('practice-input').value + e.key;
    const prefix = practiceWord.slice(0, val.length);
    if (val !== prefix) practiceErrorCount++;
  }
});

// ── Button Wiring ────────────────────────────────────────────────────────────
$('btn-play').addEventListener('click', () => startGame());
$('btn-practice').addEventListener('click', () => startPractice());
$('btn-resume').addEventListener('click', () => resumeGame());
$('btn-pause').addEventListener('click', () => pauseGame());

$('btn-menu-from-pause').addEventListener('click', () => {
  gameState = 'menu';
  cancelAnimationFrame(animId);
  showScreen('screen-menu');
  renderMenuScores();
});

$('btn-menu-from-gameover').addEventListener('click', () => {
  gameState = 'menu';
  showScreen('screen-menu');
  renderMenuScores();
});

$('btn-play-again').addEventListener('click', () => {
  startGame();
});

$('btn-save-score').addEventListener('click', () => {
  const name = $('name-input').value.trim() || 'Anonymous';
  saveScore(name, score, selectedDiff);
  $('btn-save-score').textContent = '✓ Saved!';
  $('btn-save-score').disabled = true;
  renderMenuScores();
});

$('btn-practice-back').addEventListener('click', () => {
  practiceActive = false;
  showScreen('screen-menu');
  renderMenuScores();
});

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDiff = btn.dataset.diff;
  });
});

// ── Init ─────────────────────────────────────────────────────────────────────
initStars();
initCanvas();
renderMenuScores();
showScreen('screen-menu');
