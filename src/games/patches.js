import { _rng, _el, _shell, _button, _score, _color } from './queens.js';

export function createPuzzle(seed = 1, difficulty = 'medium') {
  const n = difficulty === 'easy' ? 5 : difficulty === 'hard' ? 8 : 6, rng = _rng(seed), rectangles = [];
  const maximum = difficulty === 'hard' ? 12 : difficulty === 'easy' ? 6 : 9;
  function divide(r, c, h, w) {
    const area = h * w;
    if (area <= maximum && (area <= 3 || rng() < .7)) { rectangles.push({ r, c, h, w }); return; }
    let vertical = w > 1 && (h === 1 || (w > h ? rng() < .8 : rng() < .4));
    if (h === 1) vertical = true;
    if (w === 1) vertical = false;
    if (vertical) { const cut = 1 + Math.floor(rng() * (w - 1)); divide(r, c, h, cut); divide(r, c + cut, h, w - cut); }
    else { const cut = 1 + Math.floor(rng() * (h - 1)); divide(r, c, cut, w); divide(r + cut, c, h - cut, w); }
  }
  divide(0, 0, n, n);
  const solution = Array(n * n).fill(-1), clues = [];
  rectangles.forEach(({ r, c, h, w }, id) => {
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) solution[y * n + x] = id;
    clues.push({ cell: (r + Math.floor(rng() * h)) * n + c + Math.floor(rng() * w), area: h * w });
  });
  return { type: 'patches', variant: 'rectangle-partition', size: n, clues, solution, seed, difficulty };
}
export function checkSolution(puzzle, answer) {
  const n = puzzle.size;
  if (!Array.isArray(answer) || answer.length !== n * n || answer.some(i => !Number.isInteger(i) || i < 0)) return false;
  const groups = new Map();
  answer.forEach((id, cell) => { if (!groups.has(id)) groups.set(id, []); groups.get(id).push(cell); });
  if (groups.size !== puzzle.clues.length) return false;
  for (const cells of groups.values()) {
    const rows = cells.map(i => Math.floor(i / n)), columns = cells.map(i => i % n);
    const area = (Math.max(...rows) - Math.min(...rows) + 1) * (Math.max(...columns) - Math.min(...columns) + 1);
    const clues = puzzle.clues.filter(c => cells.includes(c.cell));
    if (area !== cells.length || clues.length !== 1 || clues[0].area !== area) return false;
  }
  return true;
}
export function mount(container, { seed = 1, difficulty = 'medium', onComplete = () => {}, onProgress = () => {} } = {}) {
  const puzzle = createPuzzle(seed, difficulty), n = puzzle.size, clueMap = new Map(puzzle.clues.map(c => [c.cell, c.area]));
  const ui = _shell(container, 'Rectangle Patches · Our Shikaku-style variant. Partition the entire board into rectangles. Each rectangle must contain exactly one number, and that number is its area in squares. Click two opposite corners to make a rectangle. Click a filled patch to erase it.', n);
  let state = Array(n * n).fill(-1), anchor = -1, hover = -1, nextId = 0, moves = 0, hints = 0, won = false;
  function rectangle(a, b) {
    const top = Math.min(Math.floor(a / n), Math.floor(b / n)), bottom = Math.max(Math.floor(a / n), Math.floor(b / n)), left = Math.min(a % n, b % n), right = Math.max(a % n, b % n), cells = [];
    for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) cells.push(r * n + c);
    return cells;
  }
  const buttons = state.map((_, cell) => {
    const b = _el('button', { type: 'button', class: 'cell lg-cell', 'aria-label': `Row ${Math.floor(cell / n) + 1}, column ${cell % n + 1}${clueMap.has(cell) ? `, area clue ${clueMap.get(cell)}` : ''}` }, [clueMap.has(cell) ? String(clueMap.get(cell)) : '']);
    ui.listen(b, 'click', () => choose(cell)); ui.listen(b, 'pointerenter', () => { if (anchor !== -1 && !won) { hover = cell; renderPreview(); } }); ui.board.append(b); return b;
  });
  ui.listen(ui.board, 'keydown', event => { if (event.key === 'Escape') { anchor = hover = -1; renderPreview(); ui.say('Selection canceled.'); } });
  function choose(cell) {
    if (won) return;
    if (anchor === -1) {
      if (state[cell] !== -1) { const id = state[cell]; state = state.map(v => v === id ? -1 : v); moves++; ui.say('Patch removed.'); render(); }
      else { anchor = hover = cell; ui.say('Choose the opposite corner. Choose the same square for a one-square patch.'); renderPreview(); }
      return;
    }
    const cells = rectangle(anchor, cell), clues = cells.filter(i => clueMap.has(i));
    anchor = hover = -1;
    if (cells.some(i => state[i] !== -1)) { ui.say('That rectangle overlaps a filled patch. Erase the existing patch first.'); renderPreview(); return; }
    if (clues.length !== 1) { ui.say(`A rectangle needs exactly one number; this selection contains ${clues.length}.`); renderPreview(); return; }
    if (clueMap.get(clues[0]) !== cells.length) { ui.say(`That number needs ${clueMap.get(clues[0])} squares, but this rectangle has ${cells.length}.`); renderPreview(); return; }
    for (const i of cells) state[i] = nextId; nextId++; moves++; ui.say('Rectangle placed.'); render();
  }
  function renderPreview() { const cells = anchor === -1 ? [] : rectangle(anchor, hover === -1 ? anchor : hover); buttons.forEach((b, i) => b.classList.toggle('lg-preview', cells.includes(i))); }
  function render() {
    buttons.forEach((b, i) => {
      const id = state[i], filled = id !== -1;
      b.style.background = filled ? `${_color(id)}30` : '#f7f8fc'; b.style.borderColor = filled ? `${_color(id)}a0` : '#dce1eb';
      const edge = same => filled && !same ? '3px' : '1px';
      b.style.borderTopWidth = edge(i >= n && state[i - n] === id);
      b.style.borderBottomWidth = edge(i + n < n * n && state[i + n] === id);
      b.style.borderLeftWidth = edge(i % n > 0 && state[i - 1] === id);
      b.style.borderRightWidth = edge(i % n < n - 1 && state[i + 1] === id);
      b.setAttribute('aria-pressed', String(filled));
    });
    renderPreview(); const filled = state.filter(v => v >= 0).length;
    ui.stats([`${filled} / ${n * n} squares`, `${new Set(state.filter(v => v >= 0)).size} / ${puzzle.clues.length} patches`, `${moves} moves`]); onProgress({ moves, accuracy: 100 });
    if (!won && checkSolution(puzzle, state)) { won = true; ui.say('Every square belongs. Your rectangle partition is complete.', true); onComplete({ score: _score(n * n, moves, hints), moves, accuracy: 100 }); }
  }
  _button(ui, 'Cancel selection', () => { anchor = hover = -1; renderPreview(); ui.say('Selection canceled.'); });
  _button(ui, 'Clear patches', () => { if (won) return; state.fill(-1); anchor = hover = -1; nextId = 0; moves++; ui.say('Board cleared.'); render(); });
  render();
  return { destroy() { ui.dispose(); }, hint() {
    if (won) return;
    let first = state.findIndex(v => v === -1);
    if (first < 0) return;
    const id = puzzle.solution[first], cells = puzzle.solution.flatMap((v, i) => v === id ? [i] : []), overlap = new Set(cells.map(i => state[i]).filter(v => v !== -1));
    state = state.map(v => overlap.has(v) ? -1 : v); for (const i of cells) state[i] = nextId; nextId++; anchor = hover = -1; moves++; hints++; ui.say(`One ${cells.length}-square rectangle has been placed. Overlapping patches were cleared.`); render();
  } };
}
