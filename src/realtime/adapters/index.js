import sudoku from './sudoku.js';
import queens from './queens.js';
import tango from './tango.js';
import nonogram from './nonogram.js';
import lightsout from './lightsout.js';

const define = (adapter, sizes, progressLabel, resultProof = () => false) => Object.freeze({ ...adapter, sizes: Object.freeze(sizes), progressLabel, resultProof });
export const adapters = Object.freeze({
  sudoku: define(sudoku, { easy: 6, medium: 6, hard: 6 }, 'entries filled'),
  queens: define(queens, { easy: 5, medium: 6, hard: 7 }, 'crowns placed', (puzzle, board) => Array.from({ length: puzzle.size }, (_, row) => board.slice(row * puzzle.size, (row + 1) * puzzle.size).indexOf(1))),
  tango: define(tango, { easy: 4, medium: 6, hard: 8 }, 'entries filled'),
  nonogram: define(nonogram, { easy: 5, medium: 6, hard: 7 }, 'clues matched'),
  lightsout: define(lightsout, { easy: 3, medium: 4, hard: 5 }, 'lights switched off'),
});
export const multiplayerGames = Object.freeze(Object.values(adapters));
export function getAdapter(game) {
  if (!Object.hasOwn(adapters, game)) throw new Error('This game is not available in online rooms.');
  return adapters[game];
}
