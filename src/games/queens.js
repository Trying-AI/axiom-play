// Pure, seeded game logic. Keep generators independent of browser state.
export function _rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function _shuffle(list, rng) { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function _el(tag, attrs = {}, children = []) { const e = document.createElement(tag); for (const [key, value] of Object.entries(attrs)) { if (value != null) e.setAttribute(key === 'className' ? 'class' : key, value); } for (const child of children) e.append(typeof child === 'string' ? document.createTextNode(child) : child); return e; }
const palette = ['#a78bfa', '#60a5fa', '#2dd4bf', '#fbbf24', '#fb7185', '#c084fc', '#a3e635', '#fb923c', '#67e8f9', '#f472b6', '#86efac', '#cbd5e1'];
export const _color = i => palette[((i % palette.length) + palette.length) % palette.length];
export function _shell(container, description, n) {
  if (!document.getElementById('axiom-logic-styles')) {
    const style = _el('style', { id: 'axiom-logic-styles' });
    style.textContent = `.lg-stage{width:100%;max-width:700px;margin:auto}.lg-description{line-height:1.7;color:var(--muted,#778094);font-size:14px;margin:0 0 18px}.lg-board{--lg-n:5;display:grid;grid-template-columns:repeat(var(--lg-n),minmax(0,1fr));gap:5px;width:min(100%,480px);margin:18px auto;position:relative;touch-action:manipulation}.lg-cell{appearance:none;display:flex;align-items:center;justify-content:center;aspect-ratio:1;min-width:0;border:1px solid #dce1eb;border-radius:9px;background:#f2f3f8;color:var(--text,#263046);font-family:inherit;font-weight:600;font-size:clamp(16px,4vw,27px);line-height:1;position:relative;cursor:pointer;transition:background .12s,border-color .12s,box-shadow .12s;user-select:none}.lg-cell:hover{border-color:#a78bfa}.lg-cell:focus-visible{outline:3px solid #b2a4ff;outline-offset:2px;z-index:4}.lg-cell.lg-marked{background:#a78bfa24}.lg-cell.lg-error{box-shadow:inset 0 0 0 2px #fb7185}.lg-cell.lg-given{font-weight:800;border-color:#aab2c9}.lg-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--muted,#778094)}.lg-meta span{padding:6px 10px;background:#f2f3f8;border:1px solid #e6e8f0;border-radius:20px}.lg-controls{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:16px}.lg-controls button{border:1px solid #dce1eb;border-radius:9px;background:#f5f5fc;color:var(--text,#263046);padding:10px 16px;cursor:pointer;font:inherit;font-size:13px}.lg-controls button:hover{border-color:#a78bfa}.lg-message{min-height:44px;text-align:center;line-height:1.5;color:var(--muted,#778094);font-size:13px;padding-top:16px}.lg-message[data-success=true]{color:#168558}.lg-queen{font-size:clamp(22px,5vw,38px);color:#342c4d}.lg-cross{font-size:20px;opacity:.45}.lg-preview{outline:2px solid #c4b5fd;outline-offset:-2px}.lg-board.lg-disabled .lg-cell{cursor:default}.lg-chip{border-radius:7px;padding:5px 8px;font-size:11px;background:#ece9fb;color:#6254a9}@media(max-width:460px){.lg-board{gap:3px}.lg-cell{border-radius:6px}.lg-description{font-size:12px}.lg-stage{padding:0}}`;
    document.head.append(style);
  }
  const listeners = [];
  const stage = _el('div', { class: 'game-stage lg-stage' });
  const instruction = _el('p', { class: 'game-instruction lg-description' }, [description]);
  const status = _el('div', { class: 'lg-meta', 'aria-live': 'polite' });
  const board = _el('div', { class: 'game-board lg-board', style: `--lg-n:${n}`, role: 'group', 'aria-label': 'Puzzle board' });
  const controls = _el('div', { class: 'game-controls lg-controls' });
  const message = _el('div', { class: 'game-message lg-message', 'aria-live': 'polite' });
  stage.append(instruction, status, board, controls, message); container.replaceChildren(stage);
  return { stage, board, controls, message, status,
    listen(target, type, fn, options) { target.addEventListener(type, fn, options); listeners.push(() => target.removeEventListener(type, fn, options)); },
    dispose() { for (const remove of listeners) remove(); stage.remove(); },
    say(text, success = false) { message.textContent = text; message.dataset.success = String(success); },
    stats(items) { status.replaceChildren(...items.map(text => _el('span', {}, [text]))); },
  };
}
export function _button(ui, text, fn) { const b = _el('button', { type: 'button', class: 'button secondary' }, [text]); ui.listen(b, 'click', fn); ui.controls.append(b); return b; }
export function _score(cells, moves, hints) { return Math.max(100, Math.round(1200 + cells * 25 - moves * 4 - hints * 100)); }

export function createPuzzle(seed = 1, difficulty = 'medium') {
  const n = difficulty === 'easy' ? 5 : difficulty === 'hard' ? 7 : 6;
  const rng = _rng(seed);
  let columns = [];
  for (let attempt = 0; attempt < 2000; attempt++) {
    columns = _shuffle(Array.from({ length: n }, (_, i) => i), rng);
    if (columns.every((c, r) => r === 0 || Math.abs(c - columns[r - 1]) > 1)) break;
  }
  if (!columns.every((c, r) => r === 0 || Math.abs(c - columns[r - 1]) > 1)) columns = Array.from({ length: n }, (_, i) => i).sort((a, b) => (a % 2 === b % 2 ? a - b : b % 2 - a % 2));
  const regions = Array(n * n).fill(-1), solution = Array(n * n).fill(0);
  const frontier = [];
  columns.forEach((col, row) => { const cell = row * n + col; regions[cell] = row; solution[cell] = 1; frontier.push(cell); });
  while (frontier.length) {
    const pick = Math.floor(rng() * frontier.length), cell = frontier[pick], r = Math.floor(cell / n), c = cell % n;
    const next = _shuffle([r > 0 ? cell - n : -1, c < n - 1 ? cell + 1 : -1, r < n - 1 ? cell + n : -1, c > 0 ? cell - 1 : -1].filter(x => x >= 0 && regions[x] === -1), rng);
    if (!next.length) frontier.splice(pick, 1);
    else { regions[next[0]] = regions[cell]; frontier.push(next[0]); }
  }
  return { type: 'queens', size: n, regions, solution, seed, difficulty };
}

export function checkSolution(puzzle, answer) {
  const n = puzzle.size;
  if (!Array.isArray(answer) || answer.length !== n * n || answer.some(x => ![0, 1, 2].includes(x))) return false;
  const queens = answer.flatMap((x, i) => x === 1 ? [i] : []);
  if (queens.length !== n) return false;
  if (new Set(queens.map(i => Math.floor(i / n))).size !== n || new Set(queens.map(i => i % n)).size !== n || new Set(queens.map(i => puzzle.regions[i])).size !== n) return false;
  return queens.every((cell, i) => queens.slice(i + 1).every(other => Math.abs(Math.floor(cell / n) - Math.floor(other / n)) > 1 || Math.abs(cell % n - other % n) > 1));
}

export function mount(container, { seed = 1, difficulty = 'medium', onComplete = () => {}, onProgress = () => {} } = {}) {
  const puzzle = createPuzzle(seed, difficulty), n = puzzle.size;
  const ui = _shell(container, `Place one crown in every row, column and colored region. Crowns cannot touch, even diagonally. Click a square to cycle crown → cross → empty. Region numbers help distinguish colors.`, n);
  let state = Array(n * n).fill(0), moves = 0, hints = 0, won = false;
  const buttons = state.map((_, cell) => {
    const b = _el('button', { type: 'button', class: 'cell lg-cell', 'aria-label': `Row ${Math.floor(cell / n) + 1}, column ${cell % n + 1}, region ${puzzle.regions[cell] + 1}` });
    b.style.background = `${_color(puzzle.regions[cell])}25`; b.style.borderColor = `${_color(puzzle.regions[cell])}66`;
    ui.listen(b, 'click', () => { if (won) return; state[cell] = (state[cell] + 1) % 3; moves++; ui.say(''); render(); }); ui.board.append(b); return b;
  });
  function render() {
    const queens = state.flatMap((v, i) => v === 1 ? [i] : []);
    const conflicts = new Set();
    for (const a of queens) for (const b of queens) if (a !== b && (Math.floor(a / n) === Math.floor(b / n) || a % n === b % n || puzzle.regions[a] === puzzle.regions[b] || (Math.abs(Math.floor(a / n) - Math.floor(b / n)) <= 1 && Math.abs(a % n - b % n) <= 1))) { conflicts.add(a); conflicts.add(b); }
    buttons.forEach((b, i) => {
      b.replaceChildren(_el('span', { class: state[i] === 1 ? 'lg-queen' : state[i] === 2 ? 'lg-cross' : '', 'aria-hidden': 'true' }, [state[i] === 1 ? '♛' : state[i] === 2 ? '×' : '']));
      b.append(_el('span', { style: 'position:absolute;left:5px;top:5px;font-size:9px;opacity:.5', 'aria-hidden': 'true' }, [String(puzzle.regions[i] + 1)]));
      b.classList.toggle('lg-error', conflicts.has(i)); b.setAttribute('aria-pressed', String(state[i] === 1));
      b.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}, region ${puzzle.regions[i] + 1}: ${state[i] === 1 ? 'crown' : state[i] === 2 ? 'cross' : 'empty'}`);
    });
    ui.stats([`${queens.length} / ${n} crowns`, `${moves} moves`, `${conflicts.size} conflicting crowns`]);
    onProgress({ moves, accuracy: queens.length ? Math.round(100 * (queens.length - conflicts.size) / queens.length) : 100 });
    if (!won && checkSolution(puzzle, state)) { won = true; ui.say('Perfect placement. Every region has its crown.', true); onComplete({ score: _score(n * n, moves, hints), moves, accuracy: 100 }); }
  }
  _button(ui, 'Clear board', () => { if (won) return; state.fill(0); moves++; ui.say('Board cleared.'); render(); });
  render();
  return { destroy() { ui.dispose(); }, hint() {
    if (won) return;
    const cell = puzzle.solution.findIndex((v, i) => v === 1 && state[i] !== 1);
    if (cell < 0) {
      const extra = state.findIndex((v, i) => v === 1 && puzzle.solution[i] !== 1);
      if (extra < 0) return;
      state[extra] = 0; moves++; hints++; ui.say('An extra crown has been removed. Each row, column and region needs exactly one.'); render(); return;
    }
    for (let i = 0; i < state.length; i++) if (state[i] === 1 && (Math.floor(i / n) === Math.floor(cell / n) || i % n === cell % n || puzzle.regions[i] === puzzle.regions[cell] || (Math.abs(Math.floor(i / n) - Math.floor(cell / n)) <= 1 && Math.abs(i % n - cell % n) <= 1))) state[i] = 0;
    state[cell] = 1; moves++; hints++; ui.say(`A crown belongs in row ${Math.floor(cell / n) + 1}, column ${cell % n + 1}.`); render();
  } };
}
