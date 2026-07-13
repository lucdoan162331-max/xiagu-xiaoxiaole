const size = 7;

const pets = [
  { id: "cat", name: "奶桃猫", color: "#ffdce9", accent: "#ff8fb3", tone: 659 },
  { id: "dog", name: "布丁狗", color: "#fff0c8", accent: "#d7a05f", tone: 523 },
  { id: "bunny", name: "棉花兔", color: "#ffffff", accent: "#ffb9cf", tone: 784 },
  { id: "bear", name: "栗子熊", color: "#d9965a", accent: "#b76d3c", tone: 392 },
  { id: "duck", name: "小黄鸭", color: "#ffe36b", accent: "#ff9d4a", tone: 587 },
  { id: "panda", name: "团子熊猫", color: "#f7f7ef", accent: "#4d4a45", tone: 440 },
];

const levelData = [
  { moves: 24, goals: { cat: 8, bunny: 8, duck: 8 } },
  { moves: 25, goals: { dog: 10, bear: 10, panda: 8 } },
  { moves: 26, goals: { cat: 10, dog: 10, bunny: 10 } },
  { moves: 28, goals: { duck: 12, bear: 12, panda: 10 } },
];

const state = {
  level: 0,
  board: [],
  selected: null,
  busy: false,
  score: 0,
  moves: 24,
  goals: {},
  combo: 0,
  tool: null,
  hints: 3,
  hammers: 2,
  shuffles: 2,
  sound: true,
  audio: null,
  musicTimer: null,
  clearing: new Set(),
  hinted: new Set(),
  pointer: null,
};

const els = {
  levelLabel: document.querySelector("#levelLabel"),
  goalText: document.querySelector("#goalText"),
  moves: document.querySelector("#moves"),
  goals: document.querySelector("#goals"),
  score: document.querySelector("#score"),
  board: document.querySelector("#board"),
  banner: document.querySelector("#banner"),
  hand: document.querySelector("#hand"),
  hintBtn: document.querySelector("#hintBtn"),
  hammerBtn: document.querySelector("#hammerBtn"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  hintCount: document.querySelector("#hintCount"),
  hammerCount: document.querySelector("#hammerCount"),
  shuffleCount: document.querySelector("#shuffleCount"),
  soundBtn: document.querySelector("#soundBtn"),
  pauseBtn: document.querySelector("#pauseBtn"),
  pausePanel: document.querySelector("#pausePanel"),
  resumeBtn: document.querySelector("#resumeBtn"),
  pauseRestartBtn: document.querySelector("#pauseRestartBtn"),
  resultPanel: document.querySelector("#resultPanel"),
  resultTitle: document.querySelector("#resultTitle"),
  resultCopy: document.querySelector("#resultCopy"),
  resultPet: document.querySelector("#resultPet"),
  nextBtn: document.querySelector("#nextBtn"),
  restartBtn: document.querySelector("#restartBtn"),
};

function startLevel(level = state.level) {
  const data = levelData[level % levelData.length];
  state.level = level % levelData.length;
  state.score = 0;
  state.moves = data.moves;
  state.goals = { ...data.goals };
  state.selected = null;
  state.busy = false;
  state.combo = 0;
  state.tool = null;
  state.hints = 3;
  state.hammers = 2;
  state.shuffles = 2;
  state.clearing.clear();
  state.hinted.clear();
  els.resultPanel.classList.add("hidden");
  els.pausePanel.classList.add("hidden");
  document.body.classList.remove("hammer-mode");

  do {
    state.board = makeBoard();
  } while (!hasLegalMove(state.board));

  render();
  updateHud();
  intro();
}

function makeBoard() {
  const board = [];
  for (let row = 0; row < size; row += 1) {
    board[row] = [];
    for (let col = 0; col < size; col += 1) {
      let type;
      do {
        type = randomType();
      } while (
        (col >= 2 && board[row][col - 1]?.type === type && board[row][col - 2]?.type === type) ||
        (row >= 2 && board[row - 1][col]?.type === type && board[row - 2][col]?.type === type)
      );
      board[row][col] = createTile(type);
    }
  }
  return board;
}

function createTile(type = randomType(), special = null) {
  return {
    type,
    special,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };
}

function randomType() {
  return Math.floor(Math.random() * pets.length);
}

async function intro() {
  state.busy = true;
  showBanner("READY", "gold");
  await wait(520);
  showBanner("GO", "gold");
  await wait(420);
  state.busy = false;
  showHintHand();
}

function render() {
  els.board.innerHTML = "";
  state.board.forEach((row, r) => {
    row.forEach((tile, c) => {
      if (!tile) {
        const empty = document.createElement("div");
        empty.className = "empty-cell";
        els.board.appendChild(empty);
        return;
      }
      const button = document.createElement("button");
      const key = pointKey(r, c);
      const pet = pets[tile.type];
      button.type = "button";
      button.className = [
        "tile",
        `pet-${pet.id}`,
        tile.special ? `special-${tile.special}` : "",
        state.selected?.row === r && state.selected?.col === c ? "selected" : "",
        state.clearing.has(key) ? "clearing" : "",
        state.hinted.has(key) ? "hinted" : "",
      ]
        .filter(Boolean)
        .join(" ");
      button.dataset.row = r;
      button.dataset.col = c;
      button.dataset.type = pet.id;
      button.setAttribute("aria-label", `${pet.name}${specialName(tile.special)}`);
      button.innerHTML = `${petSvg(pet.id)}${specialBadge(tile.special)}`;
      button.addEventListener("click", () => handleTileTap(r, c));
      button.addEventListener("pointerdown", (event) => recordPointer(event, r, c));
      button.addEventListener("pointerup", (event) => handlePointerUp(event, r, c));
      els.board.appendChild(button);
    });
  });
}

async function handleTileTap(row, col) {
  if (state.busy) return;
  warmAudio();
  hideHintHand();

  if (state.tool === "hammer") {
    await useHammer(row, col);
    return;
  }

  if (!state.selected) {
    state.selected = { row, col };
    playTap();
    render();
    return;
  }

  if (state.selected.row === row && state.selected.col === col) {
    state.selected = null;
    render();
    return;
  }

  if (!isAdjacent(state.selected, { row, col })) {
    state.selected = { row, col };
    playTap();
    render();
    return;
  }

  await attemptSwap(state.selected, { row, col });
}

function recordPointer(event, row, col) {
  state.pointer = { x: event.clientX, y: event.clientY, row, col };
}

async function handlePointerUp(event, row, col) {
  if (state.busy || state.tool === "hammer" || !state.pointer) return;
  const dx = event.clientX - state.pointer.x;
  const dy = event.clientY - state.pointer.y;
  state.pointer = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  event.preventDefault();
  const target =
    Math.abs(dx) > Math.abs(dy)
      ? { row, col: col + Math.sign(dx) }
      : { row: row + Math.sign(dy), col };
  if (!inside(target.row, target.col)) return;
  hideHintHand();
  warmAudio();
  await attemptSwap({ row, col }, target);
}

async function attemptSwap(a, b) {
  if (state.busy) return;
  state.busy = true;
  state.selected = null;
  swapTiles(a, b);
  playSwap();
  render();
  await wait(170);

  const rainbow = [state.board[a.row][a.col], state.board[b.row][b.col]].find((tile) => tile.special === "rainbow");
  if (rainbow) {
    state.moves -= 1;
    const other = state.board[a.row][a.col] === rainbow ? state.board[b.row][b.col] : state.board[a.row][a.col];
    await resolveRainbow(a, b, other.type);
    afterMove();
    return;
  }

  const matches = findMatches(state.board);
  if (matches.length === 0) {
    await invalidSwap(a, b);
    return;
  }

  state.moves -= 1;
  await resolveBoard({ origin: b });
  afterMove();
}

async function invalidSwap(a, b) {
  playNope();
  markNope(a, b);
  await wait(220);
  swapTiles(a, b);
  render();
  state.busy = false;
}

async function resolveRainbow(a, b, targetType) {
  const clear = new Set([pointKey(a.row, a.col), pointKey(b.row, b.col)]);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (state.board[row][col]?.type === targetType) clear.add(pointKey(row, col));
    }
  }
  await clearCells(clear);
  await collapseAndRefill();
  await resolveBoard();
}

async function resolveBoard(options = {}) {
  state.combo = 0;
  let matches = findMatches(state.board);

  while (matches.length > 0) {
    state.combo += 1;
    const clear = expandSpecials(matchCells(matches));
    const special = state.combo === 1 ? chooseSpecial(matches, options.origin) : null;
    if (special) {
      state.board[special.row][special.col] = createTile(special.type, special.special);
      clear.delete(pointKey(special.row, special.col));
    }

    await clearCells(clear);
    await collapseAndRefill();
    matches = findMatches(state.board);
  }

  if (!hasLegalMove(state.board)) {
    await shuffleBoard(false);
  }
}

async function clearCells(clear) {
  state.clearing = new Set(clear);
  render();
  playClear(clear.size);
  showClearWord(clear.size);
  await wait(280);

  clear.forEach((key) => {
    const { row, col } = parseKey(key);
    const tile = state.board[row][col];
    if (!tile) return;
    collectGoal(tile.type);
    state.score += 60 + state.combo * 20 + (tile.special ? 120 : 0);
    state.board[row][col] = null;
  });
  state.clearing.clear();
  render();
  updateHud();
  await wait(100);
}

async function collapseAndRefill() {
  for (let col = 0; col < size; col += 1) {
    const stack = [];
    for (let row = size - 1; row >= 0; row -= 1) {
      if (state.board[row][col]) stack.push(state.board[row][col]);
    }
    for (let row = size - 1; row >= 0; row -= 1) {
      state.board[row][col] = stack[size - 1 - row] || createTile();
    }
  }
  render();
  await wait(210);
}

function findMatches(board) {
  const groups = [];
  for (let row = 0; row < size; row += 1) {
    let start = 0;
    for (let col = 1; col <= size; col += 1) {
      const prev = board[row][col - 1]?.type;
      const curr = board[row][col]?.type;
      if (curr !== prev) {
        if (prev !== undefined && col - start >= 3) {
          groups.push({
            type: prev,
            direction: "row",
            cells: range(start, col - 1).map((c) => ({ row, col: c })),
          });
        }
        start = col;
      }
    }
  }

  for (let col = 0; col < size; col += 1) {
    let start = 0;
    for (let row = 1; row <= size; row += 1) {
      const prev = board[row - 1]?.[col]?.type;
      const curr = board[row]?.[col]?.type;
      if (curr !== prev) {
        if (prev !== undefined && row - start >= 3) {
          groups.push({
            type: prev,
            direction: "col",
            cells: range(start, row - 1).map((r) => ({ row: r, col })),
          });
        }
        start = row;
      }
    }
  }
  return groups;
}

function matchCells(matches) {
  const cells = new Set();
  matches.forEach((group) => group.cells.forEach((cell) => cells.add(pointKey(cell.row, cell.col))));
  return cells;
}

function expandSpecials(clear) {
  const expanded = new Set(clear);
  [...clear].forEach((key) => {
    const { row, col } = parseKey(key);
    const tile = state.board[row][col];
    if (!tile?.special) return;
    if (tile.special === "row") {
      for (let c = 0; c < size; c += 1) expanded.add(pointKey(row, c));
    }
    if (tile.special === "col") {
      for (let r = 0; r < size; r += 1) expanded.add(pointKey(r, col));
    }
    if (tile.special === "bomb") {
      for (let r = row - 1; r <= row + 1; r += 1) {
        for (let c = col - 1; c <= col + 1; c += 1) {
          if (inside(r, c)) expanded.add(pointKey(r, c));
        }
      }
    }
    if (tile.special === "rainbow") {
      const type = tile.type;
      for (let r = 0; r < size; r += 1) {
        for (let c = 0; c < size; c += 1) {
          if (state.board[r][c]?.type === type) expanded.add(pointKey(r, c));
        }
      }
    }
  });
  return expanded;
}

function chooseSpecial(matches, origin) {
  if (!origin) return null;
  const originKey = pointKey(origin.row, origin.col);
  const originGroups = matches.filter((group) => group.cells.some((cell) => pointKey(cell.row, cell.col) === originKey));
  const candidates = originGroups.length ? originGroups : matches;
  const biggest = [...candidates].sort((a, b) => b.cells.length - a.cells.length)[0];
  if (!biggest || biggest.cells.length < 4) return null;

  const type = biggest.type;
  const intersection = findIntersection(matches, type);
  if (intersection) {
    return { ...intersection, type, special: "bomb" };
  }
  const anchor = biggest.cells.some((cell) => pointKey(cell.row, cell.col) === originKey)
    ? origin
    : biggest.cells[Math.floor(biggest.cells.length / 2)];
  if (biggest.cells.length >= 5) return { ...anchor, type, special: "rainbow" };
  return { ...anchor, type, special: biggest.direction === "row" ? "row" : "col" };
}

function findIntersection(matches, type) {
  const rows = matches.filter((group) => group.type === type && group.direction === "row");
  const cols = matches.filter((group) => group.type === type && group.direction === "col");
  for (const rowGroup of rows) {
    for (const colGroup of cols) {
      const found = rowGroup.cells.find((cell) => colGroup.cells.some((other) => other.row === cell.row && other.col === cell.col));
      if (found) return found;
    }
  }
  return null;
}

function hasLegalMove(board) {
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      for (const next of [
        { row, col: col + 1 },
        { row: row + 1, col },
      ]) {
        if (!inside(next.row, next.col)) continue;
        if (board[row][col].special === "rainbow" || board[next.row][next.col].special === "rainbow") return true;
        swapInBoard(board, { row, col }, next);
        const legal = findMatches(board).length > 0;
        swapInBoard(board, { row, col }, next);
        if (legal) return true;
      }
    }
  }
  return false;
}

function findBestMove() {
  let winner = null;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      for (const next of [
        { row, col: col + 1 },
        { row: row + 1, col },
      ]) {
        if (!inside(next.row, next.col)) continue;
        swapTiles({ row, col }, next);
        const matches = findMatches(state.board);
        swapTiles({ row, col }, next);
        const score = matchCells(matches).size;
        if (score > (winner?.score || 0)) winner = { a: { row, col }, b: next, score };
      }
    }
  }
  return winner;
}

function useHint() {
  if (state.busy || state.hints <= 0) return;
  warmAudio();
  const move = findBestMove();
  if (!move) {
    showBanner("重排一下", "pink");
    return;
  }
  state.hints -= 1;
  state.hinted = new Set([pointKey(move.a.row, move.a.col), pointKey(move.b.row, move.b.col)]);
  moveHandTo(move.a, move.b);
  updateHud();
  render();
  playHint();
  window.setTimeout(() => {
    state.hinted.clear();
    hideHintHand();
    render();
  }, 1700);
}

async function useHammer(row, col) {
  if (state.hammers <= 0 || state.busy) return;
  state.busy = true;
  state.hammers -= 1;
  setTool(null);
  playHammer();
  await clearCells(new Set([pointKey(row, col)]));
  await collapseAndRefill();
  await resolveBoard();
  afterMove(false);
}

async function shuffleBoard(costMove = true) {
  if (costMove && (state.busy || state.shuffles <= 0)) return;
  if (costMove) {
    warmAudio();
    state.shuffles -= 1;
  }
  const flat = state.board.flat();
  let guard = 0;
  do {
    flat.sort(() => Math.random() - 0.5);
    state.board = Array.from({ length: size }, (_, row) => flat.slice(row * size, row * size + size));
    guard += 1;
  } while ((findMatches(state.board).length > 0 || !hasLegalMove(state.board)) && guard < 40);
  state.selected = null;
  state.combo = 0;
  showBanner("SHUFFLE", "gold");
  playShuffle();
  render();
  updateHud();
}

function afterMove(checkMoves = true) {
  updateHud();
  if (isWin()) {
    endLevel(true);
    return;
  }
  if (checkMoves && state.moves <= 0) {
    endLevel(false);
    return;
  }
  state.busy = false;
}

function endLevel(won) {
  state.busy = true;
  playResult(won);
  els.resultTitle.textContent = won ? "win" : "再来一次";
  els.resultCopy.textContent = won ? "萌宠目标全部完成啦。" : "差一点点，先做大连消再用道具会更稳。";
  els.nextBtn.style.display = won ? "" : "none";
  els.resultPet.innerHTML = petSvg(won ? "cat" : "bunny");
  window.setTimeout(() => els.resultPanel.classList.remove("hidden"), 360);
}

function collectGoal(type) {
  const id = pets[type].id;
  if (state.goals[id] > 0) state.goals[id] -= 1;
}

function isWin() {
  return Object.values(state.goals).every((count) => count <= 0);
}

function updateHud() {
  els.levelLabel.textContent = `Level ${state.level + 1}`;
  els.goalText.textContent = isWin() ? "目标完成" : "交换三连消除";
  els.moves.textContent = state.moves;
  els.score.textContent = state.score;
  els.hintCount.textContent = state.hints;
  els.hammerCount.textContent = state.hammers;
  els.shuffleCount.textContent = state.shuffles;
  els.hintBtn.disabled = state.hints <= 0;
  els.hammerBtn.disabled = state.hammers <= 0;
  els.shuffleBtn.disabled = state.shuffles <= 0;
  els.goals.innerHTML = Object.entries(state.goals)
    .map(([id, count]) => {
      const pet = pets.find((item) => item.id === id);
      return `<div class="goal-chip ${count <= 0 ? "done" : ""}">${miniPetSvg(id)}<strong>${Math.max(0, count)}</strong></div>`;
    })
    .join("");
}

function showClearWord(count) {
  if (count >= 9) showBanner("PERFECT", "pink");
  else if (count >= 5) showBanner("GREAT", "gold");
  else if (count >= 3) showBanner("GOOD", "gold");
}

function markNope(a, b) {
  [a, b].forEach(({ row, col }) => {
    const el = els.board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    el?.classList.add("nope");
  });
}

function setTool(tool) {
  state.tool = tool;
  els.hammerBtn.classList.toggle("active", tool === "hammer");
  document.body.classList.toggle("hammer-mode", tool === "hammer");
}

function showHintHand() {
  const move = findBestMove();
  if (move) moveHandTo(move.a, move.b);
}

function moveHandTo(a, b) {
  const left = Math.min(a.col, b.col) + 0.65;
  const top = Math.min(a.row, b.row) + 0.68;
  els.hand.style.left = `calc(${left} * (var(--cell) + var(--gap)))`;
  els.hand.style.top = `calc(${top} * (var(--cell) + var(--gap)))`;
  els.hand.classList.remove("hidden");
}

function hideHintHand() {
  els.hand.classList.add("hidden");
}

function showBanner(text, tone) {
  els.banner.textContent = text;
  els.banner.className = `banner show ${tone || ""}`;
  window.setTimeout(() => els.banner.classList.remove("show"), 900);
}

function swapTiles(a, b) {
  swapInBoard(state.board, a, b);
}

function swapInBoard(board, a, b) {
  [board[a.row][a.col], board[b.row][b.col]] = [board[b.row][b.col], board[a.row][a.col]];
}

function isAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function inside(row, col) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function pointKey(row, col) {
  return `${row}:${col}`;
}

function parseKey(key) {
  const [row, col] = key.split(":").map(Number);
  return { row, col };
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function specialName(special) {
  return special ? ` ${special}` : "";
}

function specialBadge(special) {
  if (!special) return "";
  const label = { row: "↔", col: "↕", bomb: "✦", rainbow: "★" }[special];
  return `<span class="special-badge">${label}</span>`;
}

function petSvg(id) {
  const pet = pets.find((item) => item.id === id);
  const fill = pet.color;
  const accent = pet.accent;
  const line = "#4f493f";
  const common = `fill="${fill}" stroke="${line}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
  const blush = `<ellipse cx="35" cy="67" rx="7" ry="4" fill="#ff9fb9" opacity=".6"/><ellipse cx="65" cy="67" rx="7" ry="4" fill="#ff9fb9" opacity=".6"/>`;
  const eyes = `<circle cx="39" cy="55" r="4" fill="${line}"/><circle cx="61" cy="55" r="4" fill="${line}"/>`;
  const smile = `<path d="M46 68 Q50 73 54 68" fill="none" stroke="${line}" stroke-width="3" stroke-linecap="round"/>`;

  if (id === "cat") {
    return `<svg class="pet-svg" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M24 39 L20 16 L38 28" fill="${accent}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M76 39 L80 16 L62 28" fill="${accent}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="50" cy="55" r="34" ${common}/>${eyes}${blush}${smile}
      <path d="M28 62 H16 M30 69 H18 M72 62 H84 M70 69 H82" stroke="${line}" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }
  if (id === "dog") {
    return `<svg class="pet-svg" viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="25" cy="43" rx="14" ry="24" fill="${accent}" stroke="${line}" stroke-width="4"/>
      <ellipse cx="75" cy="43" rx="14" ry="24" fill="${accent}" stroke="${line}" stroke-width="4"/>
      <circle cx="50" cy="55" r="34" ${common}/>${eyes}${blush}
      <ellipse cx="50" cy="66" rx="13" ry="10" fill="#fff7e5" stroke="${line}" stroke-width="3"/>
      <circle cx="50" cy="62" r="4" fill="${line}"/>
    </svg>`;
  }
  if (id === "bunny") {
    return `<svg class="pet-svg" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M35 34 C25 8 32 3 43 28" fill="${fill}" stroke="${line}" stroke-width="4"/>
      <path d="M65 34 C75 8 68 3 57 28" fill="${fill}" stroke="${line}" stroke-width="4"/>
      <path d="M38 28 C33 13 36 10 43 28" fill="${accent}" opacity=".72"/>
      <path d="M62 28 C67 13 64 10 57 28" fill="${accent}" opacity=".72"/>
      <circle cx="50" cy="58" r="32" ${common}/>${eyes}${blush}${smile}
    </svg>`;
  }
  if (id === "bear") {
    return `<svg class="pet-svg" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="27" cy="34" r="15" fill="${accent}" stroke="${line}" stroke-width="4"/>
      <circle cx="73" cy="34" r="15" fill="${accent}" stroke="${line}" stroke-width="4"/>
      <circle cx="50" cy="57" r="34" ${common}/>${eyes}
      <ellipse cx="50" cy="68" rx="15" ry="11" fill="#ffe2bd" stroke="${line}" stroke-width="3"/>
      <circle cx="50" cy="64" r="4" fill="${line}"/>
    </svg>`;
  }
  if (id === "duck") {
    return `<svg class="pet-svg" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M42 25 L50 12 L58 25" fill="${accent}" stroke="${line}" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="50" cy="55" r="34" ${common}/>${eyes}
      <path d="M39 66 Q50 76 61 66 Q50 63 39 66" fill="${accent}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      ${blush}
    </svg>`;
  }
  return `<svg class="pet-svg" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="31" cy="34" r="13" fill="${accent}" stroke="${line}" stroke-width="4"/>
    <circle cx="69" cy="34" r="13" fill="${accent}" stroke="${line}" stroke-width="4"/>
    <circle cx="50" cy="56" r="34" ${common}/>
    <ellipse cx="38" cy="54" rx="10" ry="12" fill="${accent}"/>
    <ellipse cx="62" cy="54" rx="10" ry="12" fill="${accent}"/>
    <circle cx="39" cy="54" r="3" fill="#fff"/><circle cx="61" cy="54" r="3" fill="#fff"/>
    <ellipse cx="50" cy="68" rx="13" ry="9" fill="#fff" stroke="${line}" stroke-width="3"/>
    <circle cx="50" cy="65" r="3" fill="${line}"/>
  </svg>`;
}

function miniPetSvg(id) {
  return `<span class="mini-pet">${petSvg(id)}</span>`;
}

function warmAudio() {
  if (!state.audio) state.audio = new (window.AudioContext || window.webkitAudioContext)();
  if (state.audio.state === "suspended") state.audio.resume();
  if (state.sound && !state.musicTimer) startMusic();
}

function startMusic() {
  const notes = [523, 659, 784, 659, 587, 698, 784, 880];
  let index = 0;
  state.musicTimer = window.setInterval(() => {
    if (!state.sound || !state.audio) return;
    chime(notes[index % notes.length], 0.028, 0.08, "sine");
    if (index % 2 === 0) chime(notes[(index + 2) % notes.length] / 2, 0.018, 0.12, "triangle", 0.02);
    index += 1;
  }, 260);
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
  osc.stop(now + length + 0.03);
}

function playTap() {
  chime(740, 0.05, 0.06, "sine");
}

function playSwap() {
  chime(520, 0.05, 0.06);
  chime(680, 0.05, 0.06, "triangle", 0.05);
}

function playNope() {
  chime(220, 0.06, 0.08);
  chime(190, 0.05, 0.1, "triangle", 0.07);
}

function playClear(count) {
  for (let i = 0; i < Math.min(count, 7); i += 1) {
    chime(520 + i * 70, 0.075, 0.1, i % 2 ? "sine" : "triangle", i * 0.032);
  }
}

function playHint() {
  [880, 1175, 1568].forEach((freq, index) => chime(freq, 0.055, 0.09, "sine", index * 0.05));
}

function playHammer() {
  [330, 510, 780].forEach((freq, index) => chime(freq, 0.075, 0.12, "triangle", index * 0.04));
}

function playShuffle() {
  [392, 523, 392, 659, 523].forEach((freq, index) => chime(freq, 0.052, 0.08, "triangle", index * 0.045));
}

function playResult(won) {
  const notes = won ? [523, 659, 784, 1046] : [392, 330, 294];
  notes.forEach((freq, index) => chime(freq, 0.08, 0.16, "sine", index * 0.08));
}

els.hintBtn.addEventListener("click", useHint);
els.hammerBtn.addEventListener("click", () => {
  if (state.busy || state.hammers <= 0) return;
  warmAudio();
  setTool(state.tool === "hammer" ? null : "hammer");
  playHint();
});
els.shuffleBtn.addEventListener("click", () => shuffleBoard(true));
els.soundBtn.addEventListener("click", () => {
  state.sound = !state.sound;
  els.soundBtn.classList.toggle("on", state.sound);
  if (state.sound) warmAudio();
  else stopMusic();
});
els.pauseBtn.addEventListener("click", () => {
  if (state.busy) return;
  state.busy = true;
  els.pausePanel.classList.remove("hidden");
});
els.resumeBtn.addEventListener("click", () => {
  els.pausePanel.classList.add("hidden");
  state.busy = false;
});
els.pauseRestartBtn.addEventListener("click", () => startLevel(state.level));
els.restartBtn.addEventListener("click", () => startLevel(state.level));
els.nextBtn.addEventListener("click", () => startLevel(state.level + 1));

startLevel(0);
