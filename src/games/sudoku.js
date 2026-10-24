import { rng, shuffled, normalizeDifficulty, el, numberInputShell, latinConflicts } from './number-shared.js';

const SIZE = 6;

function candidates(values, index) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const excluded = new Set();
  for (let i = 0; i < SIZE; i++) { excluded.add(values[row * SIZE + i]); excluded.add(values[i * SIZE + col]); }
  const startRow = Math.floor(row / 2) * 2;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = startRow; r < startRow + 2; r++) for (let c = startCol; c < startCol + 3; c++) excluded.add(values[r * SIZE + c]);
  return [1, 2, 3, 4, 5, 6].filter((value) => !excluded.has(value));
}

export function countSolutions(givens, limit = 2) {
  if (!Array.isArray(givens) || givens.length !== 36 || !Array.from(givens).every((value) => Number.isInteger(value) && value >= 0 && value <= 6)) return 0;
  const values = [...givens];
  if (latinConflicts(values, 6, true).size) return 0;
  let count = 0;
  function solve() {
    let best = -1;
    let choices = [];
    for (let index = 0; index < values.length; index++) {
      if (values[index]) continue;
      const next = candidates(values, index);
      if (!next.length) return;
      if (best < 0 || next.length < choices.length) { best = index; choices = next; }
      if (choices.length === 1) break;
    }
    if (best < 0) { count++; return; }
    for (const value of choices) {
      values[best] = value;
      solve();
      if (count >= limit) break;
    }
    values[best] = 0;
  }
  solve();
  return count;
}

export function createPuzzle(seed = 1, difficulty = 'medium') {
  difficulty = normalizeDifficulty(difficulty);
  const random = rng(seed);
  const digits = shuffled([1, 2, 3, 4, 5, 6], random);
  const rows = shuffled([0, 1, 2], random).flatMap((band) => shuffled([band * 2, band * 2 + 1], random));
  const columns = shuffled([0, 1], random).flatMap((stack) => shuffled([stack * 3, stack * 3 + 1, stack * 3 + 2], random));
  const solution = rows.flatMap((row) => columns.map((col) => digits[(row * 3 + Math.floor(row / 2) + col) % 6]));
  const givens = [...solution];
  const desiredClues = { easy: 20, medium: 14, hard: 10 }[difficulty];
  let clueCount = 36;
  for (const index of shuffled(Array.from({ length: 36 }, (_, i) => i), random)) {
    if (clueCount <= desiredClues) break;
    const old = givens[index];
    givens[index] = 0;
    if (countSolutions(givens) !== 1) givens[index] = old;
    else clueCount--;
  }
  return { kind: 'sudoku', seed, difficulty, size: 6, boxRows: 2, boxColumns: 3, givens, solution };
}

export function checkSolution(puzzle, answer) {
  return Array.isArray(answer) && answer.length === 36 && Array.from(answer).every((value, i) => Number.isInteger(value) && value >= 1 && value <= 6 && (!puzzle.givens[i] || puzzle.givens[i] === value)) && latinConflicts(answer, 6, true).size === 0;
}

export function mount(container, { seed = 1, difficulty = 'medium', onComplete, onProgress } = {}) {
  const puzzle = createPuzzle(seed, difficulty);
  return numberInputShell(container, {
    puzzle, size: 6, maxDigit: 6, title: 'Mini Sudoku', onComplete, onProgress,
    instructions: 'Fill each row, column and 2 × 3 box with the numbers 1–6, each exactly once. Every puzzle has one solution.',
    ruleLabel: '6 × 6 · unique solution',
    isComplete: (answer) => checkSolution(puzzle, answer),
    conflicts: (answer) => latinConflicts(answer, 6, true),
    buildBoard() {
      const board = el('div', 'np-grid');
      board.style.gridTemplateColumns = 'repeat(6, 1fr)';
      board.setAttribute('aria-label', '6 by 6 Sudoku board');
      const cells = Array.from({ length: 36 }, (_, index) => {
        const cell = el('button', `cell${index % 6 === 2 ? ' np-box-right' : ''}${Math.floor(index / 6) === 1 || Math.floor(index / 6) === 3 ? ' np-box-bottom' : ''}`);
        board.append(cell);
        return cell;
      });
      return { board, cells };
    },
    hintText(answer) {
      const incorrect = answer.findIndex((value, index) => value && value !== puzzle.solution[index]);
      if (incorrect >= 0) return { index: incorrect, text: `Recheck row ${Math.floor(incorrect / 6) + 1}, column ${incorrect % 6 + 1}. That entry prevents a valid solution; try erasing it first.` };
      let best = -1;
      let choices = [];
      for (let index = 0; index < 36; index++) {
        if (answer[index]) continue;
        const next = candidates(answer, index);
        if (best < 0 || next.length < choices.length) { best = index; choices = next; }
      }
      const location = `Row ${Math.floor(best / 6) + 1}, column ${best % 6 + 1}`;
      return { index: best, text: choices.length === 1 ? `${location} must be ${choices[0]}: its row, column and box rule out every other digit.` : `${location} has candidates ${choices.join(', ')}. The next valid step is ${puzzle.solution[best]}; compare its row, column and box.` };
    },
  });
}
