const size = 8;
const targetScore = 4500;
const maxMoves = 28;

const heroes = [
  {
    id: "blade",
    name: "曜刃",
    mark: "刃",
    quote: "剑光一闪，峡谷听令。",
    color: "linear-gradient(135deg, #ff6f61, #f6c55d)",
    image: "",
    voice: "./assets/voices/blade.mp3",
  },
  {
    id: "moon",
    name: "月影",
    mark: "月",
    quote: "月色落下，连击升起。",
    color: "linear-gradient(135deg, #8f7aff, #43dcc0)",
    image: "",
    voice: "./assets/voices/moon.mp3",
  },
  {
    id: "flame",
    name: "炽心",
    mark: "焰",
    quote: "这一击，燃到最后。",
    color: "linear-gradient(135deg, #ff4d3d, #ffb347)",
    image: "",
    voice: "./assets/voices/flame.mp3",
  },
  {
    id: "tide",
    name: "澜歌",
    mark: "澜",
    quote: "浪潮会记住你的连消。",
    color: "linear-gradient(135deg, #22c1c3, #1b8fd6)",
    image: "",
    voice: "./assets/voices/tide.mp3",
  },
  {
    id: "star",
    name: "星瞳",
    mark: "星",
    quote: "星轨已经排好阵了。",
    color: "linear-gradient(135deg, #ffe66d, #7bdff2)",
    image: "",
    voice: "./assets/voices/star.mp3",
  },
  {
    id: "forest",
    name: "森守",
    mark: "森",
    quote: "草丛里，也有高光。",
    color: "linear-gradient(135deg, #58d68d, #117a65)",
    image: "",
    voice: "./assets/voices/forest.mp3",
  },
  {
    id: "thunder",
    name: "霆鼓",
    mark: "霆",
    quote: "鼓点越快，爆得越响。",
    color: "linear-gradient(135deg, #f9ca24, #6c5ce7)",
    image: "",
    voice: "./assets/voices/thunder.mp3",
  },
  {
    id: "lotus",
    name: "莲华",
    mark: "莲",
    quote: "花开一瞬，满屏清场。",
    color: "linear-gradient(135deg, #fd79a8, #00cec9)",
    image: "",
    voice: "./assets/voices/lotus.mp3",
  },
];

const bonds = [
  { ids: ["blade", "moon"], title: "月下拔刀", text: "曜刃 + 月影同时开麦，额外加 600 分。" },
  { ids: ["flame", "tide"], title: "水火不服", text: "炽心 + 澜歌互相抢话，生成一次爆裂播报。" },
  { ids: ["forest", "star"], title: "草丛观星", text: "森守 + 星瞳触发隐藏吐槽字幕。" },
  { ids: ["thunder", "lotus"], title: "雷打花开", text: "霆鼓 + 莲华进入 3 秒高能连爆。" },
];

let board = [];
let selected = null;
let score = 0;
let moves = maxMoves;
let combo = 0;
let bestCombo = 0;
let isBusy = false;
let soundOn = true;
let lastRemovedHeroes = [];
let heroCounts = new Map();
let audioContext = null;
let matchingKeys = new Set();

const els = {
  board: document.querySelector("#board"),
  score: document.querySelector("#score"),
  moves: document.querySelector("#moves"),
  combo: document.querySelector("#combo"),
  target: document.querySelector("#target"),
  banner: document.querySelector("#banner"),
  voiceFeed: document.querySelector("#voiceFeed"),
  bondList: document.querySelector("#bondList"),
  tip: document.querySelector("#tip"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  soundBtn: document.querySelector("#soundBtn"),
  newGameBtn: document.querySelector("#newGameBtn"),
  resultModal: document.querySelector("#resultModal"),
  resultTitle: document.querySelector("#resultTitle"),
  finalScore: document.querySelector("#finalScore"),
  bestCombo: document.querySelector("#bestCombo"),
  mvpHero: document.querySelector("#mvpHero"),
  resultCopy: document.querySelector("#resultCopy"),
  playAgainBtn: document.querySelector("#playAgainBtn"),
};

function randomHero() {
  return heroes[Math.floor(Math.random() * heroes.length)];
}

function createTile(hero = randomHero(), special = null) {
  return {
    hero,
    special,
    id: `${hero.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };
}

function startGame() {
  score = 0;
  moves = maxMoves;
  combo = 0;
  bestCombo = 0;
  selected = null;
  isBusy = false;
  heroCounts = new Map();
  lastRemovedHeroes = [];
  els.resultModal.classList.add("hidden");
  board = Array.from({ length: size }, () => Array.from({ length: size }, () => createTile()));
  while (findMatches().length > 0) {
    board = Array.from({ length: size }, () => Array.from({ length: size }, () => createTile()));
  }
  renderBonds();
  updateHud();
  render();
  addVoice("系统", "峡谷已开局，第一波连爆正在路上。");
}

function render() {
  els.board.innerHTML = "";
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const tile = board[row][col];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tile${selected?.row === row && selected?.col === col ? " selected" : ""}${matchingKeys.has(pointKey({ row, col })) ? " matching" : ""}${tile.special ? ` special-${tile.special}` : ""}`;
      button.style.setProperty("--hero-gradient", tile.hero.color);
      button.dataset.row = row;
      button.dataset.col = col;
      button.dataset.hero = tile.hero.id;
      button.dataset.mark = tile.hero.mark;
      button.title = `${tile.hero.name}：${tile.hero.quote}`;
      button.setAttribute("aria-label", `${tile.hero.name}头像`);

      if (tile.hero.image) {
        button.classList.add("has-portrait");
        const portrait = document.createElement("img");
        portrait.className = "portrait";
        portrait.src = tile.hero.image;
        portrait.alt = "";
        portrait.onerror = () => {
          portrait.remove();
          button.classList.remove("has-portrait");
        };
        button.appendChild(portrait);
      }

      if (tile.special) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = getSpecialMark(tile.special);
        button.appendChild(badge);
      }

      button.addEventListener("click", () => handleTileClick(row, col));
      els.board.appendChild(button);
    }
  }
}

function getSpecialMark(special) {
  return {
    row: "横",
    col: "纵",
    bomb: "爆",
    ultra: "大",
  }[special];
}

async function handleTileClick(row, col) {
  if (isBusy || moves <= 0) return;
  warmAudio();

  if (!selected) {
    selected = { row, col };
    render();
    return;
  }

  if (selected.row === row && selected.col === col) {
    selected = null;
    render();
    return;
  }

  if (!isAdjacent(selected, { row, col })) {
    selected = { row, col };
    render();
    return;
  }

  isBusy = true;
  swap(selected, { row, col });
  render();
  await wait(150);

  const matches = findMatches();
  const hasSpecialTrigger = board[selected.row][selected.col].special || board[row][col].special;
  if (matches.length === 0 && !hasSpecialTrigger) {
    swap(selected, { row, col });
    combo = 0;
    selected = null;
    render();
    updateHud();
    isBusy = false;
    return;
  }

  moves -= 1;
  await resolveBoard(matches, [selected, { row, col }]);
  selected = null;
  updateHud();
  render();
  isBusy = false;
  checkGameEnd();
}

async function resolveBoard(initialMatches, movedTiles = []) {
  let matches = initialMatches;
  let cascade = 0;

  while (matches.length > 0 || movedTiles.some((pos) => board[pos.row]?.[pos.col]?.special)) {
    cascade += 1;
    combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    const clearSet = expandSpecialClears(matches, movedTiles);
    const removed = [...clearSet].map(keyToPoint).map(({ row, col }) => board[row][col]).filter(Boolean);
    lastRemovedHeroes = removed.map((tile) => tile.hero);

    const preservedKey = maybeCreateSpecial(matches);
    if (preservedKey) clearSet.delete(preservedKey);
    matchingKeys = new Set(clearSet);
    updateHud();
    render();
    await wait(250);

    score += clearSet.size * 90 * Math.max(1, combo) + Math.max(0, clearSet.size - 3) * 120;
    clearTiles(clearSet);
    matchingKeys = new Set();
    playMatchFeedback(removed, clearSet.size, cascade);
    await wait(110);
    collapseBoard();
    refillBoard();
    render();
    await wait(170);
    matches = findMatches();
    movedTiles = [];
  }
}

function isAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function swap(a, b) {
  [board[a.row][a.col], board[b.row][b.col]] = [board[b.row][b.col], board[a.row][a.col]];
}

function findMatches() {
  const groups = [];

  for (let row = 0; row < size; row += 1) {
    let start = 0;
    for (let col = 1; col <= size; col += 1) {
      const current = board[row][col]?.hero.id;
      const previous = board[row][col - 1]?.hero.id;
      if (current !== previous) {
        if (col - start >= 3) {
          groups.push(rangeToGroup(row, start, col - 1, "row"));
        }
        start = col;
      }
    }
  }

  for (let col = 0; col < size; col += 1) {
    let start = 0;
    for (let row = 1; row <= size; row += 1) {
      const current = board[row]?.[col]?.hero.id;
      const previous = board[row - 1]?.[col]?.hero.id;
      if (current !== previous) {
        if (row - start >= 3) {
          groups.push(rangeToGroup(start, col, row - 1, "col"));
        }
        start = row;
      }
    }
  }

  return groups;
}

function rangeToGroup(a, b, c, direction) {
  const cells = [];
  if (direction === "row") {
    for (let col = b; col <= c; col += 1) cells.push({ row: a, col });
  } else {
    for (let row = a; row <= c; row += 1) cells.push({ row, col: b });
  }
  return { direction, cells };
}

function expandSpecialClears(matches, movedTiles) {
  const clearSet = new Set();
  matches.forEach((group) => group.cells.forEach((cell) => clearSet.add(pointKey(cell))));
  movedTiles.forEach((pos) => {
    const tile = board[pos.row]?.[pos.col];
    if (!tile?.special) return;
    addSpecialClear(clearSet, pos, tile.special);
  });

  [...clearSet].map(keyToPoint).forEach((pos) => {
    const tile = board[pos.row]?.[pos.col];
    if (tile?.special) addSpecialClear(clearSet, pos, tile.special);
  });

  return clearSet;
}

function addSpecialClear(clearSet, pos, special) {
  if (special === "row") {
    for (let col = 0; col < size; col += 1) clearSet.add(pointKey({ row: pos.row, col }));
  }
  if (special === "col") {
    for (let row = 0; row < size; row += 1) clearSet.add(pointKey({ row, col: pos.col }));
  }
  if (special === "bomb") {
    for (let row = pos.row - 1; row <= pos.row + 1; row += 1) {
      for (let col = pos.col - 1; col <= pos.col + 1; col += 1) {
        if (board[row]?.[col]) clearSet.add(pointKey({ row, col }));
      }
    }
  }
  if (special === "ultra") {
    const heroId = board[pos.row][pos.col].hero.id;
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (board[row][col].hero.id === heroId) clearSet.add(pointKey({ row, col }));
      }
    }
  }
}

function maybeCreateSpecial(matches) {
  const longest = matches.reduce((winner, group) => (group.cells.length > winner.cells.length ? group : winner), { cells: [] });
  if (longest.cells.length < 4) return null;
  const anchor = longest.cells[Math.floor(longest.cells.length / 2)];
  const hero = board[anchor.row][anchor.col].hero;
  const special = longest.cells.length >= 5 ? "ultra" : longest.direction === "row" ? "row" : "col";
  board[anchor.row][anchor.col] = createTile(hero, special);
  return pointKey(anchor);
}

function clearTiles(clearSet) {
  clearSet.forEach((key) => {
    const { row, col } = keyToPoint(key);
    board[row][col] = null;
  });
}

function collapseBoard() {
  for (let col = 0; col < size; col += 1) {
    const survivors = [];
    for (let row = size - 1; row >= 0; row -= 1) {
      if (board[row][col]) survivors.push(board[row][col]);
    }
    for (let row = size - 1; row >= 0; row -= 1) {
      board[row][col] = survivors[size - 1 - row] || null;
    }
  }
}

function refillBoard() {
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!board[row][col]) board[row][col] = createTile();
    }
  }
}

function playMatchFeedback(removed, clearCount, cascade) {
  if (removed.length === 0) return;
  const hero = removed[Math.floor(Math.random() * removed.length)].hero;
  heroCounts.set(hero.id, (heroCounts.get(hero.id) || 0) + 1);
  addVoice(hero.name, hero.quote);
  playHeroVoice(hero, cascade);
  triggerBondIfNeeded(removed);

  if (clearCount >= 24) {
    showBanner("五杀清屏");
    addVoice("峡谷播报", "满屏开花，这一波可以直接发朋友圈。");
  } else if (combo >= 6) {
    showBanner("峡谷发疯");
  } else if (combo >= 4) {
    showBanner("连爆暴走");
  } else if (clearCount >= 5) {
    showBanner("大招头像");
  }
}

function triggerBondIfNeeded(removed) {
  const ids = new Set(removed.map((tile) => tile.hero.id));
  const bond = bonds.find((item) => item.ids.every((id) => ids.has(id)));
  if (!bond) return;
  score += 600;
  addVoice("羁绊彩蛋", bond.text);
  showBanner(bond.title);
}

function addVoice(name, quote) {
  const line = document.createElement("div");
  line.className = "voice-line";
  line.innerHTML = `<strong>${name}</strong>：${quote}`;
  els.voiceFeed.prepend(line);
  while (els.voiceFeed.children.length > 6) {
    els.voiceFeed.lastElementChild.remove();
  }
}

function renderBonds() {
  els.bondList.innerHTML = bonds
    .map((bond) => `<div class="bond"><strong>${bond.title}</strong><br>${bond.text}</div>`)
    .join("");
}

function playHeroVoice(hero, cascade) {
  if (!soundOn) return;
  const audio = new Audio(hero.voice);
  audio.volume = 0.82;
  audio.play().catch(() => playSyntheticVoice(cascade));
}

function warmAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") audioContext.resume();
}

function playSyntheticVoice(cascade) {
  warmAudio();
  const now = audioContext.currentTime;
  const notes = [220, 277, 330, 415, 554];
  notes.slice(0, Math.min(5, 2 + cascade)).forEach((freq, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = index % 2 ? "triangle" : "sawtooth";
    osc.frequency.setValueAtTime(freq + combo * 18, now + index * 0.045);
    gain.gain.setValueAtTime(0.0001, now + index * 0.045);
    gain.gain.exponentialRampToValueAtTime(0.08, now + index * 0.045 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.045 + 0.16);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now + index * 0.045);
    osc.stop(now + index * 0.045 + 0.17);
  });
}

function showBanner(text) {
  els.banner.textContent = text;
  els.banner.classList.remove("show");
  void els.banner.offsetWidth;
  els.banner.classList.add("show");
}

function updateHud() {
  els.score.textContent = score;
  els.moves.textContent = moves;
  els.combo.textContent = combo;
  els.target.textContent = targetScore;
  els.tip.textContent =
    combo >= 5
      ? "高能状态：继续连消会触发更夸张的开麦播报。"
      : moves <= 6
        ? "最后几步，优先制造 4 连或 5 连技能头像。"
        : "交换相邻头像，凑齐三个以上即可触发开麦消除。";
}

function checkGameEnd() {
  if (score < targetScore && moves > 0) return;
  const won = score >= targetScore;
  const mvp = getMvpHero();
  els.resultTitle.textContent = won ? "峡谷开麦成功" : "差一点就封神";
  els.finalScore.textContent = `${score} 分`;
  els.bestCombo.textContent = `最高 ${bestCombo} 连`;
  els.mvpHero.textContent = `MVP：${mvp?.name || "-"}`;
  els.resultCopy.textContent = won
    ? "这一局已经有短视频名场面的味道了：连击、开麦、清屏，一口气都齐了。"
    : "核心循环已经跑起来了，下一局多做技能头像，会更容易爆分。";
  els.resultModal.classList.remove("hidden");
}

function getMvpHero() {
  let winner = null;
  let max = 0;
  heroCounts.forEach((count, id) => {
    if (count > max) {
      max = count;
      winner = heroes.find((hero) => hero.id === id);
    }
  });
  return winner;
}

function shuffleBoard() {
  if (isBusy) return;
  const flat = board.flat().sort(() => Math.random() - 0.5);
  board = Array.from({ length: size }, (_, row) => flat.slice(row * size, row * size + size));
  selected = null;
  combo = 0;
  addVoice("系统", "棋盘已重整，峡谷重新洗牌。");
  render();
  updateHud();
}

function pointKey({ row, col }) {
  return `${row}:${col}`;
}

function keyToPoint(key) {
  const [row, col] = key.split(":").map(Number);
  return { row, col };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

els.shuffleBtn.addEventListener("click", shuffleBoard);
els.soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  els.soundBtn.classList.toggle("active", soundOn);
  els.soundBtn.title = soundOn ? "声音开关：开" : "声音开关：关";
});
els.newGameBtn.addEventListener("click", startGame);
els.playAgainBtn.addEventListener("click", startGame);

startGame();
