import { element, listenScope, moveFocus, numericBoard } from './shared.js';

const palette = ['#c4b5fd', '#93c5fd', '#5eead4', '#fde68a', '#fda4af', '#d8b4fe', '#bef264'];

export function validPuzzle(puzzle) {
  return [5, 6, 7].includes(puzzle?.size) && numericBoard(puzzle.regions, puzzle.size ** 2, puzzle.size - 1)
    && new Set(puzzle.regions).size === puzzle.size;
}

export function validBoard(puzzle, board) { return numericBoard(board, puzzle.size ** 2, 2); }

export function conflicts(puzzle, board) {
  const size = puzzle.size, invalid = new Set();
  const crowns = board.flatMap((value, i) => value === 1 ? [i] : []);
  for (let a = 0; a < crowns.length; a++) for (let b = a + 1; b < crowns.length; b++) {
    const i = crowns[a], j = crowns[b];
    const row = Math.floor(i / size), column = i % size, otherRow = Math.floor(j / size), otherColumn = j % size;
    if (row === otherRow || column === otherColumn || puzzle.regions[i] === puzzle.regions[j] || (Math.abs(row - otherRow) <= 1 && Math.abs(column - otherColumn) <= 1)) {
      invalid.add(i); invalid.add(j);
    }
  }
  return invalid;
}

export function complete(puzzle, board) {
  return validBoard(puzzle, board) && board.filter(n => n === 1).length === puzzle.size && conflicts(puzzle, board).size === 0;
}

export function progress(puzzle, board) { return Math.min(100, Math.floor(100 * board.filter(n => n === 1).length / puzzle.size)); }

export function mount(container, { puzzle, board: initial, onChange }) {
  if (!validPuzzle(puzzle) || !validBoard(puzzle, initial)) throw new Error('The Queens puzzle or saved board is invalid.');
  const scope = listenScope(), size = puzzle.size;
  let board = [...initial], locked = true;
  const stage = element('div', { class: 'rmp-puzzle' });
  const grid = element('div', { class: 'rmp-board rmp-queens', style: `--board-size:${size}`, role: 'group', 'aria-label': `Your ${size} by ${size} Queens board` });
  const message = element('p', { class: 'rmp-board-note', 'aria-live': 'polite' });
  const cells = board.map((_, i) => {
    const cell = element('button', { type: 'button', class: 'rmp-cell', style: `--region:${palette[puzzle.regions[i]]}` });
    const symbol = element('span', { class: 'rmp-crown', 'aria-hidden': 'true' });
    cell.append(element('span', { class: 'rmp-region-number', 'aria-hidden': 'true' }, [String(puzzle.regions[i] + 1)]), symbol);
    scope.on(cell, 'click', () => {
      if (locked) return;
      const next = [...board]; next[i] = (next[i] + 1) % 3;
      if (onChange(next) !== false) { board = next; render(); }
    });
    grid.append(cell); return { cell, symbol };
  });
  scope.on(grid, 'keydown', event => moveFocus(event, cells.map(item => item.cell), size));
  function render() {
    const errors = conflicts(puzzle, board), count = board.filter(n => n === 1).length;
    cells.forEach(({ cell, symbol }, i) => {
      symbol.textContent = board[i] === 1 ? '♛' : board[i] === 2 ? '×' : '';
      cell.classList.toggle('rmp-conflict', errors.has(i));
      cell.setAttribute('aria-label', `Row ${Math.floor(i / size) + 1}, column ${i % size + 1}, region ${puzzle.regions[i] + 1}: ${board[i] === 1 ? 'crown' : board[i] === 2 ? 'cross' : 'empty'}${errors.has(i) ? ', conflict' : ''}`);
      cell.setAttribute('aria-pressed', String(board[i] === 1));
      cell.setAttribute('aria-disabled', String(locked));
    });
    grid.dataset.locked = String(locked);
    message.textContent = `${count} / ${size} crowns${errors.size ? ` · ${errors.size} conflicting` : ''}. Tap a square to cycle crown → cross → empty.`;
  }
  stage.append(grid, message); container.replaceChildren(stage); render();
  return {
    update(next, options = {}) { if (!validBoard(puzzle, next)) throw new Error('Invalid saved Queens board.'); board = [...next]; locked = options.locked ?? locked; render(); },
    destroy() { scope.destroy(); stage.remove(); },
  };
}

export default { id: 'queens', title: 'Queens', description: 'Place one crown in each row, column and colored region. Crowns cannot touch, even diagonally. Each player has a private board.', validPuzzle, validBoard, initialBoard: puzzle => Array(puzzle.size ** 2).fill(0), complete, progress, mount };
