const boardSize = 5;

const pets = [
  { id: "momo", name: "粉桃", className: "pet-momo", tone: 523.25 },
  { id: "pudding", name: "布丁", className: "pet-pudding", tone: 392.0 },
  { id: "leaf", name: "芽芽", className: "pet-leaf", tone: 659.25 },
  { id: "bear", name: "栗熊", className: "pet-bear", tone: 329.63 },
  { id: "snow", name: "雪团", className: "pet-snow", tone: 587.33 },
];

const levels = [
  [
    [0, 1, 2, 2, 2],
    [0, 0, 1, 3, 4],
    [4, 0, 3, 3, 4],
    [4, 1, 0, 0, 2],
    [4, 4, 1, 2, 2],
  ],
  [
    [3, 3, 0, 1, 1],
    [2, 3, 0, 4, 1],
    [2, 2, 4, 4, 1],
    [0, 2, 3, 0, 0],
    [4, 4, 3, 3, 0],
  ],
  [
    [1, 1, 2, 2, 4],
    [3, 1, 0, 2, 4],
    [3, 3, 0, 0, 4],
    [2, 4, 4, 1, 1],
    [2, 2, 3, 3, 1],
  ],
  [
    [0, 2, 2, 3, 3],
    [0, 0, 4, 4, 3],
    [1, 0, 4, 2, 2],
    [1, 1, 3, 3, 4],
    [2, 1, 0, 4, 4],
  ],
];

const state = {
  board: [],
  level: 0,
  score: 0,
  removed: 0,
  total: boardSize * boardSize,
  combo: 0,
  locked: false,
  tool: null,
  hints: 3,
  bombs: 2,
  shuffles: 2,
  sound: true,
  audio: null,
  musicTimer: null,
  highlighted: new Set(),
};

const els = {
  board: document.querySelector("#board"),
  banner: document.querySelector("#banner"),
  hand: document.querySelector("#hand"),
  score: document.querySelector("#score"),
  progressBar: document.querySelector("#progressBar"),
  progressPet: document.querySelector("#progressPet"),
  hintBtn: document.querySelector("#hintBtn"),
  bombBtn: document.querySelector("#bombBtn"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  soundBtn: document.querySelector("#soundBtn"),
  hintCount: document.querySelector("#hintCount"),
  bombCount: document.querySelector("#bombCount"),
  shuffleCount: document.querySelector("#shuffleCount"),
  winPanel: document.querySelector("#winPanel"),
  nextBtn: document.querySelector("#nextBtn"),
  pauseBtn: document.querySelector("#pauseBtn"),
  pausePanel: document.querySelector("#pausePanel"),
  resumeBtn: document.querySelector("#resumeBtn"),
  restartBtn: document.querySelector("#restartBtn"),
};

function startLevel(index = state.level) {
  const source = levels[index % levels.length];
  state.level = index % levels.length;
  state.board = source.map((row, r) =>
    row.map((type, c) => ({
      type,
      id: `${index}-${r}-${c}-${Math.random().toString(16).slice(2)}`,
    })),
  );
  state.score = 0;
  state.removed = 0;
  state.combo = 0;
  state.locked = false;
  state.tool = null;
  state.hints = 3;
  state.bombs = 2;
  state.shuffles = 2;
  state.highlighted.clear();
  els.winPanel.classList.add("hidden");
  els.pausePanel.classList.add("hidden");
  render();
  updateHud();
  intro();
}

function render() {
  els.board.innerHTML = "";
  state.board.forEach((row, r) => {
    row.forEach((tile, c) => {
      const key = pointKey(r, c);
      if (!tile) {
        const empty = document.createElement("div");
        empty.className = "empty-cell";
        els.board.appendChild(empty);
        return;
      }

      const pet = pets[tile.type];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tile ${pet.className}${state.highlighted.has(key) ? " hinted" : ""}`;
      button.dataset.row = r;
      button.dataset.col = c;
      button.setAttribute("aria-label", `${pet.name}贴纸`);
      button.innerHTML = `
        <span class="sticker">
          <span class="ears"></span>
          <span class="face">
            <span class="eyes"></span>
            <span class="mouth"></span>
            <span class="blush"></span>
          </span>
        </span>
      `;
      button.addEventListener("click", () => handleTile(r, c));
      els.board.appendChild(button);
    });
  });
}

async function intro() {
  state.locked = true;
  showBanner("READY", "ready");
  await wait(620);
  showBanner("GO", "go");
  await wait(460);
  state.locked = false;
  showHandHint();
}

async function handleTile(row, col) {
  if (state.locked) return;
  warmAudio();
  hideHandHint();

  if (state.tool === "bomb") {
    await useBomb(row, col);
    return;
  }

  const group = collectGroup(row, col);
  if (group.length < 2) {
    tapNope(row, col);
    playNope();
    return;
  }

  await removeGroup(group, "tap");
}

async function removeGroup(group, source) {
  state.locked = true;
  state.highlighted = new Set(group.map(({ row, col }) => pointKey(row, col)));
  render();
  await wait(160);

  const pet = pets[state.board[group[0].row][group[0].col].type];
  group.forEach(({ row, col }) => {
    state.board[row][col] = null;
  });

  state.removed += group.length;
  state.combo += 1;
  const bonus = group.length >= 5 ? 160 : group.length >= 4 ? 90 : group.length >= 3 ? 40 : 0;
  state.score += group.length * 50 + bonus + Math.max(0, state.combo - 1) * 20;

  state.highlighted.clear();
  render();
  updateHud();
  popFloating(group, group.length >= 5 ? "PERFECT" : group.length >= 3 ? "GOOD" : "");
  playPop(pet.tone, group.length, source);

  if (group.length >= 4 && Math.random() > 0.35) {
    await wait(170);
    showBanner("PERFECT", "perfect");
  } else if (group.length >= 3) {
    await wait(130);
    showBanner("GOOD", "good");
  }

  await wait(260);
  if (isCleared() || remainingCount() <= 1) {
    await clearFinalDust();
    await win();
    return;
  }

  if (availableGroups().length === 0) {
    showBanner("道具时间", "good");
    pulseTools();
  }
  state.locked = false;
}

async function useBomb(row, col) {
  if (state.bombs <= 0) return;
  state.bombs -= 1;
  state.tool = null;
  setToolMode(null);
  const cells = [];
  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = col - 1; c <= col + 1; c += 1) {
      if (state.board[r]?.[c]) cells.push({ row: r, col: c });
    }
  }
  if (cells.length === 0) {
    updateHud();
    return;
  }
  playBomb();
  showBanner("POOF", "good");
  await removeGroup(cells, "bomb");
}

function useHint() {
  if (state.locked || state.hints <= 0) return;
  warmAudio();
  const groups = availableGroups();
  if (groups.length === 0) {
    showBanner("没有成组", "good");
    playNope();
    return;
  }
  state.hints -= 1;
  const best = groups.sort((a, b) => b.length - a.length)[0];
  state.highlighted = new Set(best.map(({ row, col }) => pointKey(row, col)));
  render();
  updateHud();
  playHint();
  moveHandTo(best[Math.floor(best.length / 2)]);
  window.setTimeout(() => {
    state.highlighted.clear();
    render();
  }, 1600);
}

function useShuffle() {
  if (state.locked || state.shuffles <= 0) return;
  warmAudio();
  state.shuffles -= 1;
  state.combo = 0;
  const pieces = state.board.flat().filter(Boolean);
  const positions = [];
  state.board.forEach((row, r) => row.forEach((tile, c) => tile && positions.push({ row: r, col: c })));
  const sorted = pieces.sort((a, b) => a.type - b.type || Math.random() - 0.5);
  positions.forEach((pos, index) => {
    state.board[pos.row][pos.col] = sorted[index];
  });
  playShuffle();
  showBanner("SHUFFLE", "go");
  render();
  updateHud();
}

function collectGroup(row, col) {
  const tile = state.board[row]?.[col];
  if (!tile) return [];
  const group = [];
  const seen = new Set();
  const queue = [{ row, col }];

  while (queue.length) {
    const current = queue.shift();
    const key = pointKey(current.row, current.col);
    if (seen.has(key)) continue;
    seen.add(key);
    const nextTile = state.board[current.row]?.[current.col];
    if (!nextTile || nextTile.type !== tile.type) continue;
    group.push(current);
    [
      { row: current.row - 1, col: current.col },
      { row: current.row + 1, col: current.col },
      { row: current.row, col: current.col - 1 },
      { row: current.row, col: current.col + 1 },
    ].forEach((next) => {
      if (state.board[next.row]?.[next.col]) queue.push(next);
    });
  }

  return group;
}

function availableGroups() {
  const seen = new Set();
  const groups = [];
  state.board.forEach((row, r) => {
    row.forEach((tile, c) => {
      const key = pointKey(r, c);
      if (!tile || seen.has(key)) return;
      const group = collectGroup(r, c);
      group.forEach((cell) => seen.add(pointKey(cell.row, cell.col)));
      if (group.length >= 2) groups.push(group);
    });
  });
  return groups;
}

function updateHud() {
  els.score.textContent = state.score;
  const progress = Math.min(1, state.removed / state.total);
  els.progressBar.style.width = `${progress * 100}%`;
  els.progressPet.style.left = `${Math.max(0, Math.min(94, progress * 94))}%`;
  els.hintCount.textContent = state.hints;
  els.bombCount.textContent = state.bombs;
  els.shuffleCount.textContent = state.shuffles;
  els.hintBtn.disabled = state.hints <= 0;
  els.bombBtn.disabled = state.bombs <= 0;
  els.shuffleBtn.disabled = state.shuffles <= 0;
}

function showBanner(text, tone = "") {
  els.banner.textContent = text;
  els.banner.className = `banner show ${tone}`;
  window.setTimeout(() => {
    els.banner.classList.remove("show");
  }, 920);
}

function popFloating(group, label) {
  group.forEach(({ row, col }, index) => {
    const marker = document.createElement("span");
    marker.className = "pop-star";
    marker.style.left = `calc(${col} * (var(--cell) + var(--gap)) + var(--cell) * .5)`;
    marker.style.top = `calc(${row} * (var(--cell) + var(--gap)) + var(--cell) * .5)`;
    marker.style.animationDelay = `${index * 18}ms`;
    els.board.appendChild(marker);
  });

  if (!label) return;
  const center = group[Math.floor(group.length / 2)];
  const word = document.createElement("span");
  word.className = "floating-word";
  word.textContent = label;
  word.style.left = `calc(${center.col} * (var(--cell) + var(--gap)) + var(--cell) * .12)`;
  word.style.top = `calc(${center.row} * (var(--cell) + var(--gap)) + var(--cell) * .05)`;
  els.board.appendChild(word);
}

async function win() {
  state.locked = true;
  playWin();
  await wait(350);
  els.winPanel.classList.remove("hidden");
}

function isCleared() {
  return state.board.flat().every((tile) => tile === null);
}

async function clearFinalDust() {
  const leftovers = [];
  state.board.forEach((row, r) => {
    row.forEach((tile, c) => {
      if (tile) leftovers.push({ row: r, col: c });
    });
  });
  if (leftovers.length === 0) return;
  state.highlighted = new Set(leftovers.map(({ row, col }) => pointKey(row, col)));
  render();
  playHint();
  await wait(220);
  leftovers.forEach(({ row, col }) => {
    state.board[row][col] = null;
  });
  state.removed += leftovers.length;
  state.score += leftovers.length * 80 + 240;
  state.highlighted.clear();
  render();
  updateHud();
  showBanner("PERFECT", "perfect");
  await wait(360);
}

function remainingCount() {
  return state.board.flat().filter(Boolean).length;
}

function tapNope(row, col) {
  const tile = els.board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  tile?.classList.add("nope");
  window.setTimeout(() => tile?.classList.remove("nope"), 280);
}

function pulseTools() {
  [els.bombBtn, els.shuffleBtn].forEach((button) => {
    button.classList.add("pulse");
    window.setTimeout(() => button.classList.remove("pulse"), 1200);
  });
}

function setToolMode(tool) {
  state.tool = tool;
  els.bombBtn.classList.toggle("active", tool === "bomb");
  document.body.classList.toggle("aiming", tool === "bomb");
}

function showHandHint() {
  const group = availableGroups().sort((a, b) => b.length - a.length)[0];
  if (!group) return;
  moveHandTo(group[Math.floor(group.length / 2)]);
}

function hideHandHint() {
  els.hand.classList.add("hidden");
}

function moveHandTo(cell) {
  els.hand.classList.remove("hidden");
  els.hand.style.left = `calc(${cell.col} * (var(--cell) + var(--gap)) + var(--cell) * .58)`;
  els.hand.style.top = `calc(${cell.row} * (var(--cell) + var(--gap)) + var(--cell) * .55)`;
}

function warmAudio() {
  if (!state.audio) {
    state.audio = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audio.state === "suspended") state.audio.resume();
  if (state.sound && !state.musicTimer) startMusic();
}

function startMusic() {
  const pattern = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 783.99, 880.0];
  let index = 0;
  state.musicTimer = window.setInterval(() => {
    if (!state.sound || !state.audio) return;
    chime(pattern[index % pattern.length], 0.045, 0.055, "sine", 0.02);
    if (index % 2 === 0) chime(pattern[(index + 2) % pattern.length] / 2, 0.035, 0.09, "triangle", 0.012);
    index += 1;
  }, 250);
}

function stopMusic() {
  window.clearInterval(state.musicTimer);
  state.musicTimer = null;
}

function chime(freq, volume, length, type = "triangle", delay = 0) {
  if (!state.sound || !state.audio) return;
  const now = state.audio.currentTime + delay;
  const osc = state.audio.createOscillator();
  const gain = state.audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
  osc.connect(gain);
  gain.connect(state.audio.destination);
  osc.start(now);
  osc.stop(now + length + 0.02);
}

function playPop(freq, count, source) {
  if (!state.sound) return;
  const steps = Math.min(6, count);
  for (let i = 0; i < steps; i += 1) {
    chime(freq * (1 + i * 0.08), 0.09, 0.11, i % 2 ? "sine" : "triangle", i * 0.035);
  }
  if (source === "bomb") chime(146.83, 0.12, 0.28, "sine", 0.02);
}

function playHint() {
  [880, 1174.66, 1567.98].forEach((freq, i) => chime(freq, 0.07, 0.09, "sine", i * 0.05));
}

function playNope() {
  [220, 196].forEach((freq, i) => chime(freq, 0.06, 0.09, "triangle", i * 0.06));
}

function playBomb() {
  [164.81, 220, 329.63, 493.88].forEach((freq, i) => chime(freq, 0.1, 0.16, "sawtooth", i * 0.025));
}

function playShuffle() {
  [392, 523.25, 392, 659.25, 523.25].forEach((freq, i) => chime(freq, 0.055, 0.08, "triangle", i * 0.045));
}

function playWin() {
  [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, i) => chime(freq, 0.09, 0.18, "sine", i * 0.09));
}

function pointKey(row, col) {
  return `${row}:${col}`;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

els.hintBtn.addEventListener("click", useHint);
els.bombBtn.addEventListener("click", () => {
  if (state.locked || state.bombs <= 0) return;
  warmAudio();
  setToolMode(state.tool === "bomb" ? null : "bomb");
  playHint();
});
els.shuffleBtn.addEventListener("click", useShuffle);
els.soundBtn.addEventListener("click", () => {
  state.sound = !state.sound;
  els.soundBtn.classList.toggle("on", state.sound);
  if (!state.sound) stopMusic();
  if (state.sound) warmAudio();
});
els.nextBtn.addEventListener("click", () => startLevel(state.level + 1));
els.pauseBtn.addEventListener("click", () => {
  els.pausePanel.classList.remove("hidden");
  state.locked = true;
});
els.resumeBtn.addEventListener("click", () => {
  els.pausePanel.classList.add("hidden");
  state.locked = false;
});
els.restartBtn.addEventListener("click", () => startLevel(state.level));

startLevel(0);
