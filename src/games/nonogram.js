import { _rng, _shell, _el, _button, _score } from './queens.js';

export function lineClues(line) {
  const clues = []; let run = 0;
  for (const value of [...line, 0]) {
    if (value === 1) run++;
    else if (run) { clues.push(run); run = 0; }
  }
  return clues;
}
const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
function cluesFor(board, size) {
  return {
    rowClues: Array.from({ length: size }, (_, row) => lineClues(board.slice(row * size, (row + 1) * size))),
    columnClues: Array.from({ length: size }, (_, column) => lineClues(Array.from({ length: size }, (_, row) => board[row * size + column]))),
  };
}

// At most 128 patterns per line. Prefix pruning avoids enumerating whole boards.
// An exhausted search never claims uniqueness.
export function solvePuzzle(puzzle, limit = 2, nodeLimit = 30000) {
  const n = puzzle?.size;
  if (!Number.isInteger(n) || n < 1 || n > 7 || !Number.isInteger(limit) || limit < 1 || !Number.isInteger(nodeLimit) || nodeLimit < 1) return { count: 0, solution: null, exhausted: true };
  const validClues = clues => Array.isArray(clues) && clues.length === n && Array.from(clues).every(line => Array.isArray(line) && Array.from(line).every(value => Number.isInteger(value) && value >= 1 && value <= n));
  if (!validClues(puzzle.rowClues) || !validClues(puzzle.columnClues)) return { count: 0, solution: null, exhausted: true };
  const patterns = clues => Array.from({ length: 2 ** n }, (_, mask) => mask).filter(mask => same(lineClues(Array.from({ length: n }, (_, i) => (mask >>> i) & 1)), clues));
  const rows = puzzle.rowClues.map(patterns), columns = puzzle.columnClues.map(patterns);
  let count = 0, solution = null, nodes = 0, exhausted = false;
  const chosen = [];
  function visit(row, domains) {
    if (count >= limit || exhausted) return;
    if (++nodes > nodeLimit) { exhausted = true; return; }
    if (row === n) {
      count++;
      if (!solution) solution = chosen.flatMap(mask => Array.from({ length: n }, (_, column) => (mask >>> column) & 1));
      return;
    }
    for (const mask of rows[row]) {
      const next = domains.map((domain, column) => domain.filter(candidate => ((candidate >>> row) & 1) === ((mask >>> column) & 1)));
      if (next.some(domain => domain.length === 0)) continue;
      chosen[row] = mask; visit(row + 1, next);
      if (count >= limit || exhausted) return;
    }
  }
  if (rows.every(row => row.length) && columns.every(column => column.length)) visit(0, columns);
  return { count, solution, exhausted };
}

export function createPuzzle(seed = 1, difficulty = 'medium') {
  const size = difficulty === 'easy' ? 5 : difficulty === 'hard' ? 7 : 6;
  const random = _rng(seed);
  for (let attempt = 0; attempt < 40; attempt++) {
    const solution = Array.from({ length: size * size }, () => Number(random() < 0.57));
    if (solution.every(value => value === solution[0])) continue;
    const puzzle = { type: 'nonogram', size, ...cluesFor(solution, size), solution, seed, difficulty };
    const result = solvePuzzle(puzzle);
    if (result.count === 1 && !result.exhausted) return puzzle;
  }
  // A staircase has uniquely forced row/column totals. Mirroring preserves uniqueness.
  const flipRows = random() < 0.5, flipColumns = random() < 0.5;
  const solution = Array.from({ length: size * size }, (_, cell) => {
    const row = flipRows ? size - 1 - Math.floor(cell / size) : Math.floor(cell / size);
    const column = flipColumns ? size - 1 - cell % size : cell % size;
    return Number(column <= row);
  });
  return { type: 'nonogram', size, ...cluesFor(solution, size), solution, seed, difficulty };
}

export function checkSolution(puzzle, answer) {
  const n = puzzle.size;
  if (!Array.isArray(answer) || answer.length !== n * n || Array.from(answer).some(value => ![0, 1, 2].includes(value))) return false;
  const clues = cluesFor(answer, n);
  return clues.rowClues.every((line, i) => same(line, puzzle.rowClues[i])) && clues.columnClues.every((line, i) => same(line, puzzle.columnClues[i]));
}

export function mount(container, { seed = 1, difficulty = 'medium', onProgress = () => {}, onComplete = () => {} } = {}) {
  const puzzle = createPuzzle(seed, difficulty), n = puzzle.size;
  const ui = _shell(container, 'Fill squares to match the runs shown beside each row and above each column. Separate runs with at least one empty square. Choose Cross to mark an empty square; crosses are optional. Click a marked square again to erase it.', n);
  ui.board.setAttribute('aria-label', 'Nonogram puzzle with row and column clues');
  ui.board.style.gridTemplateColumns = `minmax(42px, .9fr) repeat(${n}, minmax(0, 1fr))`;
  ui.board.append(_el('span', { 'aria-hidden': 'true', style: 'align-self:end;text-align:right;font-size:10px;color:var(--muted)' }, ['Clues']));
  puzzle.columnClues.forEach((clue, i) => ui.board.append(_el('div', { 'aria-label': `Column ${i + 1} clues: ${clue.join(', ') || '0'}`, style: 'display:flex;align-items:center;justify-content:flex-end;flex-direction:column;font-size:13px;line-height:1.5;min-height:48px;padding-bottom:3px' }, (clue.length ? clue : [0]).map(value => _el('span', {}, [String(value)])))));
  let state = Array(n * n).fill(0), moves = 0, hints = 0, mode = 1, won = false, disposed = false;
  const buttons = state.map((_, cell) => {
    if (cell % n === 0) {
      const row = Math.floor(cell / n), clue = puzzle.rowClues[row];
      ui.board.append(_el('div', { 'aria-label': `Row ${row + 1} clues: ${clue.join(', ') || '0'}`, style: 'display:flex;align-items:center;justify-content:flex-end;gap:4px;padding-right:4px;font-size:13px' }, [clue.join(' ') || '0']));
    }
    const button = _el('button', { type: 'button', class: 'cell lg-cell', style: 'border-radius:4px;font-size:20px' });
    const mark = value => { if (won || disposed) return; state[cell] = state[cell] === value ? 0 : value; moves++; ui.say(''); render(); };
    ui.listen(button, 'click', () => mark(mode));
    ui.listen(button, 'contextmenu', event => { event.preventDefault(); mark(2); });
    ui.board.append(button); return button;
  });
  const fill = _button(ui, 'Fill squares', () => { mode = 1; updateMode(); });
  const cross = _button(ui, 'Cross squares', () => { mode = 2; updateMode(); });
  function updateMode() {
    [fill, cross].forEach((button, i) => { button.setAttribute('aria-pressed', String(mode === i + 1)); button.style.background = mode === i + 1 ? '#e6e0ff' : ''; });
  }
  function render() {
    buttons.forEach((button, i) => {
      button.textContent = state[i] === 2 ? '×' : '';
      button.style.background = state[i] === 1 ? '#8170df' : '#f2f3f8';
      button.setAttribute('aria-pressed', String(state[i] === 1));
      button.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}: ${state[i] === 1 ? 'filled' : state[i] === 2 ? 'crossed out' : 'empty'}`);
      button.disabled = won;
    });
    const current = cluesFor(state, n);
    const completed = current.rowClues.filter((line, i) => same(line, puzzle.rowClues[i])).length + current.columnClues.filter((line, i) => same(line, puzzle.columnClues[i])).length;
    ui.stats([`${completed} / ${n * 2} clues matched`, `${moves} moves`]);
    onProgress({ moves, accuracy: Math.round(100 * completed / (n * 2)) });
    if (!won && checkSolution(puzzle, state)) {
      won = true; buttons.forEach(button => { button.disabled = true; });
      ui.say('Picture complete. Every row and column matches its clues.', true);
      onComplete({ score: _score(n * n, moves, hints), moves, accuracy: 100 });
    }
  }
  _button(ui, 'Check puzzle', () => {
    if (won || disposed) return;
    const current = cluesFor(state, n);
    const rows = current.rowClues.flatMap((line, i) => same(line, puzzle.rowClues[i]) ? [] : [i + 1]);
    const columns = current.columnClues.flatMap((line, i) => same(line, puzzle.columnClues[i]) ? [] : [i + 1]);
    ui.say(`Keep going. ${rows.length ? `Rows ${rows.join(', ')} need work. ` : 'Rows match. '}${columns.length ? `Columns ${columns.join(', ')} need work.` : 'Columns match.'}`);
  });
  _button(ui, 'Clear board', () => { if (won || disposed) return; state.fill(0); moves++; ui.say('Board cleared.'); render(); });
  updateMode(); render();
  return {
    destroy() { disposed = true; ui.dispose(); },
    hint() {
      if (won || disposed) return;
      const cell = state.findIndex((value, i) => Number(value === 1) !== puzzle.solution[i]);
      if (cell < 0) return;
      state[cell] = puzzle.solution[cell] === 1 ? 1 : 2; moves++; hints++;
      ui.say(`Row ${Math.floor(cell / n) + 1}, column ${cell % n + 1} should be ${state[cell] === 1 ? 'filled' : 'empty'}.`); render();
    },
  };
}
