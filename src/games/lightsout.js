import { _rng, _shell, _el, _button, _score } from './queens.js';

function validBoard(board, size) {
  return Number.isInteger(size) && size >= 1 && size <= 5 && Array.isArray(board) && board.length === size * size && Array.from(board).every(value => value === 0 || value === 1);
}
function neighbors(cell, size) {
  const row = Math.floor(cell / size), column = cell % size;
  return [cell, row ? cell - size : -1, row < size - 1 ? cell + size : -1, column ? cell - 1 : -1, column < size - 1 ? cell + 1 : -1].filter(index => index >= 0);
}
export function applyMove(board, size, cell) {
  if (!validBoard(board, size) || !Number.isInteger(cell) || cell < 0 || cell >= board.length) throw new RangeError('A move requires a binary square board and a cell inside it.');
  const next = [...board];
  for (const index of neighbors(cell, size)) next[index] ^= 1;
  return next;
}

// Solve A*x = board over GF(2). At most 25 variables fit in one 32-bit row.
// Free variables are zero; this returns a valid solution, not a minimum-move claim.
export function solveBoard(board, size) {
  if (!validBoard(board, size)) return null;
  const total = size * size, coefficientMask = (1 << total) - 1;
  const rows = board.map((value, cell) => neighbors(cell, size).reduce((mask, index) => mask | (1 << index), value << total));
  const pivots = []; let rank = 0;
  for (let column = 0; column < total; column++) {
    let pivot = rank;
    while (pivot < total && !(rows[pivot] & (1 << column))) pivot++;
    if (pivot === total) continue;
    [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
    for (let row = 0; row < total; row++) if (row !== rank && (rows[row] & (1 << column))) rows[row] ^= rows[rank];
    pivots[rank++] = column;
  }
  if (rows.some(row => !(row & coefficientMask) && ((row >>> total) & 1))) return null;
  const moves = Array(total).fill(0);
  pivots.forEach((column, row) => { moves[column] = (rows[row] >>> total) & 1; });
  return moves;
}

export function createPuzzle(seed = 1, difficulty = 'medium') {
  const size = difficulty === 'easy' ? 3 : difficulty === 'hard' ? 5 : 4;
  const random = _rng(seed), solution = Array(size * size).fill(0);
  let board = [...solution];
  for (let cell = 0; cell < board.length; cell++) if (random() < 0.5) board = applyMove(board, size, cell);
  if (board.every(value => value === 0)) board = applyMove(board, size, Math.floor(random() * board.length));
  return { type: 'lightsout', size, board, solution, solutionMoves: solveBoard(board, size), seed, difficulty };
}
export function checkSolution(puzzle, answer) {
  return validBoard(answer, puzzle.size) && answer.every(value => value === 0);
}

export function mount(container, { seed = 1, difficulty = 'medium', onProgress = () => {}, onComplete = () => {} } = {}) {
  const puzzle = createPuzzle(seed, difficulty), n = puzzle.size;
  const ui = _shell(container, 'Turn every light off. Press a square to toggle it and its immediate neighbours above, below, left and right. A second press undoes the same toggle. The starting board is always solvable.', n);
  ui.board.setAttribute('aria-label', 'Lights Out puzzle');
  let state = [...puzzle.board], moves = 0, hints = 0, won = false, disposed = false;
  const history = [];
  function move(cell, isHint = false) {
    if (won || disposed) return;
    state = applyMove(state, n, cell); history.push(cell);
    if (history.length > 200) history.shift();
    moves++; if (isHint) hints++;
    ui.say(isHint ? `Toggled row ${Math.floor(cell / n) + 1}, column ${cell % n + 1} along a valid route to lights out.` : ''); render();
  }
  const buttons = state.map((_, cell) => {
    const button = _el('button', { type: 'button', class: 'cell lg-cell' });
    ui.listen(button, 'click', () => move(cell)); ui.board.append(button); return button;
  });
  function render() {
    buttons.forEach((button, i) => {
      button.textContent = state[i] ? '●' : '·';
      button.style.background = state[i] ? '#ffe293' : '#e9eaf2';
      button.style.color = state[i] ? '#8f5f11' : '#8990a3';
      button.style.borderColor = state[i] ? '#edc55c' : '#d9dce7';
      button.setAttribute('aria-pressed', String(Boolean(state[i])));
      button.setAttribute('aria-label', `Row ${Math.floor(i / n) + 1}, column ${i % n + 1}: light ${state[i] ? 'on' : 'off'}`);
      button.disabled = won;
    });
    ui.stats([`${state.reduce((sum, value) => sum + value, 0)} lights on`, `${moves} moves`]);
    onProgress({ moves, accuracy: 100 });
    if (!won && checkSolution(puzzle, state)) {
      won = true; buttons.forEach(button => { button.disabled = true; });
      ui.say('All lights out. Beautifully switched.', true);
      onComplete({ score: _score(n * n, moves, hints), moves, accuracy: 100 });
    }
  }
  _button(ui, 'Undo move', () => {
    if (won || disposed || !history.length) return;
    state = applyMove(state, n, history.pop()); moves++; ui.say('Last toggle undone.'); render();
  });
  _button(ui, 'Restart board', () => { if (won || disposed) return; state = [...puzzle.board]; history.length = 0; moves++; ui.say('Starting lights restored.'); render(); });
  render();
  return {
    destroy() { disposed = true; ui.dispose(); },
    hint() {
      if (won || disposed) return;
      const solutionMoves = solveBoard(state, n), cell = solutionMoves?.findIndex(value => value === 1) ?? -1;
      if (cell >= 0) move(cell, true);
    },
  };
}
