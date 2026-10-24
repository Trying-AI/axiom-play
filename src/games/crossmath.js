import { rng, shuffled, normalizeDifficulty, el, numberInputShell } from './number-shared.js';

// Evaluate multiplication before addition/subtraction. No eval or expression parsing.
export function evaluate(values, operations) {
  if (values.length !== 3 || operations.length !== 2) return NaN;
  let sum = 0;
  let term = values[0];
  for (let i = 0; i < 2; i++) {
    if (operations[i] === '×') term *= values[i + 1];
    else if (operations[i] === '+') { sum += term; term = values[i + 1]; }
    else if (operations[i] === '−') { sum += term; term = -values[i + 1]; }
    else return NaN;
  }
  return sum + term;
}

function equations(puzzle) {
  return [
    ...puzzle.horizontal.map((rule, row) => ({ ...rule, cells: [row * 3, row * 3 + 1, row * 3 + 2] })),
    ...puzzle.vertical.map((rule, column) => ({ ...rule, cells: [column, column + 3, column + 6] })),
  ];
}

function solve(puzzle, limit = 2) {
  const rules = equations(puzzle);
  const options = rules.map((rule) => {
    const matches = [];
    for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) for (let c = 1; c <= 9; c++) {
      if (a !== b && a !== c && b !== c && evaluate([a, b, c], rule.ops) === rule.target) matches.push([a, b, c]);
    }
    return matches;
  });
  const answer = [...puzzle.givens];
  let used = 0;
  for (const value of answer) {
    if (!value) continue;
    if (used & (1 << value)) return [];
    used |= 1 << value;
  }
  const results = [];
  function possibleForRule(ruleIndex, position) {
    const rule = rules[ruleIndex];
    let mask = 0;
    for (const tuple of options[ruleIndex]) {
      let valid = true;
      for (let j = 0; j < 3; j++) {
        const value = answer[rule.cells[j]];
        if ((value && value !== tuple[j]) || (!value && (used & (1 << tuple[j])))) { valid = false; break; }
      }
      if (valid) mask |= 1 << tuple[position];
    }
    return mask;
  }
  function visit() {
    let best = -1;
    let choices = 0;
    let count = 10;
    for (let index = 0; index < 9; index++) {
      if (answer[index]) continue;
      const row = Math.floor(index / 3);
      const col = index % 3;
      const mask = possibleForRule(row, col) & possibleForRule(3 + col, row);
      if (!mask) return;
      let bits = mask;
      let length = 0;
      while (bits) { bits &= bits - 1; length++; }
      if (length < count) { best = index; choices = mask; count = length; }
      if (length === 1) break;
    }
    if (best < 0) {
      if (rules.every((rule) => evaluate(rule.cells.map((index) => answer[index]), rule.ops) === rule.target)) results.push([...answer]);
      return;
    }
    for (let value = 1; value <= 9; value++) {
      const bit = 1 << value;
      if (!(choices & bit)) continue;
      answer[best] = value;
      used |= bit;
      visit();
      used ^= bit;
      answer[best] = 0;
      if (results.length >= limit) return;
    }
  }
  visit();
  return results;
}

export function countSolutions(puzzle, limit = 2) { return solve(puzzle, limit).length; }

export function createPuzzle(seed = 1, difficulty = 'medium') {
  difficulty = normalizeDifficulty(difficulty);
  const random = rng(seed);
  const solution = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const choices = difficulty === 'easy' ? ['+', '×'] : ['+', '−', '×'];
  function rule(values) {
    const ops = [choices[Math.floor(random() * choices.length)], choices[Math.floor(random() * choices.length)]];
    return { ops, target: evaluate(values, ops) };
  }
  const horizontal = Array.from({ length: 3 }, (_, row) => rule(solution.slice(row * 3, row * 3 + 3)));
  const vertical = Array.from({ length: 3 }, (_, column) => rule([solution[column], solution[column + 3], solution[column + 6]]));
  const givens = Array(9).fill(0);
  const initialClues = { easy: 3, medium: 1, hard: 0 }[difficulty];
  const positions = shuffled(Array.from({ length: 9 }, (_, i) => i), random);
  positions.slice(0, initialClues).forEach((index) => { givens[index] = solution[index]; });
  const puzzle = { kind: 'crossmath', seed, difficulty, size: 3, horizontal, vertical, givens, solution };
  // Add only the clues needed to distinguish otherwise valid alternative solutions.
  for (let i = initialClues; i < 9; i++) {
    const results = solve(puzzle);
    if (results.length === 1) break;
    const alternative = results.find((answer) => answer.some((value, index) => value !== solution[index]));
    const differences = positions.filter((index) => !givens[index] && (!alternative || alternative[index] !== solution[index]));
    const index = differences[0];
    if (index === undefined) break;
    givens[index] = solution[index];
  }
  return puzzle;
}

export function checkSolution(puzzle, answer) {
  return Array.isArray(answer) && answer.length === 9 && new Set(answer).size === 9 && answer.every((value, index) => Number.isInteger(value) && value >= 1 && value <= 9 && (!puzzle.givens[index] || puzzle.givens[index] === value)) && equations(puzzle).every((rule) => evaluate(rule.cells.map((index) => answer[index]), rule.ops) === rule.target);
}

export function mount(container, { seed = 1, difficulty = 'medium', onComplete, onProgress } = {}) {
  const puzzle = createPuzzle(seed, difficulty);
  const rules = equations(puzzle);
  return numberInputShell(container, {
    puzzle, size: 3, maxDigit: 9, title: 'Cross Math', onComplete, onProgress,
    instructions: 'Place the digits 1–9 exactly once across the whole board. Every row and column must equal its green target. Multiply before adding or subtracting.',
    ruleLabel: '1–9 once · × before + and −',
    isComplete: (answer) => checkSolution(puzzle, answer),
    conflicts(answer) {
      const errors = new Set();
      const seen = new Map();
      answer.forEach((value, index) => { if (!value) return; if (seen.has(value)) { errors.add(index); errors.add(seen.get(value)); } else seen.set(value, index); });
      for (const rule of rules) if (rule.cells.every((index) => answer[index]) && evaluate(rule.cells.map((index) => answer[index]), rule.ops) !== rule.target) rule.cells.forEach((index) => errors.add(index));
      return errors;
    },
    buildBoard() {
      const board = el('div', 'np-cross');
      board.setAttribute('aria-label', 'Cross Math equation grid');
      const cells = [];
      function token(text, row, column, target = false) {
        const node = el('span', `np-cross-token${target ? ' np-cross-target' : ''}`, text);
        node.style.gridRow = String(row);
        node.style.gridColumn = String(column);
        board.append(node);
      }
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const cell = el('button', 'cell');
          cell.style.gridRow = String(row * 2 + 1);
          cell.style.gridColumn = String(col * 2 + 1);
          cells.push(cell);
          board.append(cell);
          if (col < 2) token(puzzle.horizontal[row].ops[col], row * 2 + 1, col * 2 + 2);
          if (row < 2) token(puzzle.vertical[col].ops[row], row * 2 + 2, col * 2 + 1);
        }
        token('=', row * 2 + 1, 6);
        token(puzzle.horizontal[row].target, row * 2 + 1, 7, true);
        token('=', 6, row * 2 + 1);
        token(puzzle.vertical[row].target, 7, row * 2 + 1, true);
      }
      return { board, cells };
    },
    hintText(answer, selected) {
      const incorrect = answer.findIndex((value, index) => value && value !== puzzle.solution[index]);
      if (incorrect >= 0) return { index: incorrect, text: `Recheck row ${Math.floor(incorrect / 3) + 1}, column ${incorrect % 3 + 1}. That digit cannot satisfy all six equations. Remember to do multiplication first.` };
      const index = selected >= 0 && !answer[selected] ? selected : answer.findIndex((value) => !value);
      const row = Math.floor(index / 3);
      const rule = puzzle.horizontal[row];
      const formula = answer.slice(row * 3, row * 3 + 3).map((value, i) => `${row * 3 + i === index ? puzzle.solution[index] : value || '?'}${i < 2 ? ` ${rule.ops[i]} ` : ''}`).join('');
      return { index, text: `Try ${puzzle.solution[index]} in the selected cell. Its row becomes ${formula} = ${rule.target}. Apply multiplication first, then check the intersecting column.` };
    },
  });
}
