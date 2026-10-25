import sudoku from './sudoku.js';
import queens from './queens.js';
export const adapters = Object.freeze({ sudoku, queens });
export function getAdapter(game) {
  if (!Object.hasOwn(adapters, game)) throw new Error('Online rooms support Sudoku and Queens.');
  return adapters[game];
}
