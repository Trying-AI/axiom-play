import { rng, shuffled, normalizeDifficulty, el, numberInputShell, latinConflicts } from './number-shared.js';

export function cageSatisfied(cage, values) {
  if (values.some((value) => !Number.isInteger(value) || value < 1)) return false;
  if (cage.operation === '=') return values.length === 1 && values[0] === cage.target;
  if (cage.operation === '+') return values.reduce((sum, value) => sum + value, 0) === cage.target;
  if (cage.operation === '×') return values.reduce((product, value) => product * value, 1) === cage.target;
  if (cage.operation === '−') return values.length === 2 && Math.abs(values[0] - values[1]) === cage.target;
  if (cage.operation === '÷') return values.length === 2 && Math.max(...values) === Math.min(...values) * cage.target;
  return false;
}

function cageTuples(cage, size) {
  const result = [];
  const tuple = [];
  function walk(position) {
    if (position === cage.cells.length) {
      if (cageSatisfied(cage, tuple)) result.push([...tuple]);
      return;
    }
    const index = cage.cells[position];
    for (let value = 1; value <= size; value++) {
      let duplicate = false;
      for (let previous = 0; previous < position; previous++) {
        const other = cage.cells[previous];
        if (tuple[previous] === value && (Math.floor(index / size) === Math.floor(other / size) || index % size === other % size)) { duplicate = true; break; }
      }
      if (duplicate) continue;
      tuple[position] = value;
      walk(position + 1);
    }
    tuple.length = position;
  }
  walk(0);
  return result;
}

function solve(puzzle, limit = 2, budget = 60000) {
  const { size, cages } = puzzle;
  const board = [...puzzle.givens];
  const rowMasks = new Uint16Array(size);
  const columnMasks = new Uint16Array(size);
  const cageByCell = [];
  const tuples = cages.map((cage, cageIndex) => {
    cage.cells.forEach((index, position) => { cageByCell[index] = [cageIndex, position]; });
    return cageTuples(cage, size);
  });
  for (let index = 0; index < board.length; index++) {
    if (!board[index]) continue;
    const bit = 1 << board[index];
    const row = Math.floor(index / size);
    const column = index % size;
    if ((rowMasks[row] | columnMasks[column]) & bit) return { count: 0, exhausted: false, solutions: [] };
    rowMasks[row] |= bit;
    columnMasks[column] |= bit;
  }
  let count = 0;
  let nodes = 0;
  let exhausted = false;
  const solutions = [];
  function candidates(index) {
    const [cageIndex, position] = cageByCell[index];
    const cage = cages[cageIndex];
    let mask = 0;
    for (const tuple of tuples[cageIndex]) {
      let valid = true;
      for (let j = 0; j < cage.cells.length; j++) {
        const other = cage.cells[j];
        if (board[other]) {
          if (board[other] !== tuple[j]) { valid = false; break; }
        } else if ((rowMasks[Math.floor(other / size)] | columnMasks[other % size]) & (1 << tuple[j])) { valid = false; break; }
      }
      if (valid) mask |= 1 << tuple[position];
    }
    return mask;
  }
  function visit() {
    if (++nodes > budget) { exhausted = true; return; }
    let best = -1;
    let choices = 0;
    let choiceCount = 99;
    for (let index = 0; index < board.length; index++) {
      if (board[index]) continue;
      const mask = candidates(index);
      if (!mask) return;
      let bits = mask;
      let length = 0;
      while (bits) { bits &= bits - 1; length++; }
      if (length < choiceCount) { best = index; choices = mask; choiceCount = length; }
      if (length === 1) break;
    }
    if (best < 0) {
      if (cages.every((cage) => cageSatisfied(cage, cage.cells.map((index) => board[index])))) { count++; solutions.push([...board]); }
      return;
    }
    const row = Math.floor(best / size);
    const col = best % size;
    for (let value = 1; value <= size; value++) {
      const bit = 1 << value;
      if (!(choices & bit)) continue;
      board[best] = value;
      rowMasks[row] |= bit;
      columnMasks[col] |= bit;
      visit();
      rowMasks[row] ^= bit;
      columnMasks[col] ^= bit;
      board[best] = 0;
      if (count >= limit || exhausted) return;
    }
  }
  visit();
  return { count, exhausted, solutions };
}

export function countSolutions(puzzle, limit = 2) {
  const result = solve(puzzle, limit, 250000);
  return result.exhausted ? limit : result.count;
}

export function createPuzzle(seed = 1, difficulty = 'medium') {
  difficulty = normalizeDifficulty(difficulty);
  const size = { easy: 4, medium: 5, hard: 6 }[difficulty];
  const random = rng(seed);
  const order = Array.from({ length: size }, (_, i) => i);
  const rows = shuffled(order, random);
  const columns = shuffled(order, random);
  const digits = shuffled(order.map((value) => value + 1), random);
  const solution = rows.flatMap((row) => columns.map((col) => digits[(row + col) % size]));
  const remaining = new Set(Array.from({ length: size * size }, (_, i) => i));
  const cages = [];
  function neighbors(index) {
    const result = [];
    if (index % size) result.push(index - 1);
    if (index % size < size - 1) result.push(index + 1);
    if (index >= size) result.push(index - size);
    if (index < size * (size - 1)) result.push(index + size);
    return result;
  }
  while (remaining.size) {
    const start = [...remaining][Math.floor(random() * remaining.size)];
    remaining.delete(start);
    const cells = [start];
    const desired = difficulty === 'easy' ? 2 : 2 + Math.floor(random() * (difficulty === 'hard' ? 3 : 2));
    while (cells.length < desired) {
      const frontier = [...new Set(cells.flatMap(neighbors))].filter((index) => remaining.has(index));
      if (!frontier.length) break;
      const next = frontier[Math.floor(random() * frontier.length)];
      cells.push(next);
      remaining.delete(next);
    }
    cells.sort((a, b) => a - b);
    const values = cells.map((index) => solution[index]);
    const operations = ['+', '×'];
    if (cells.length === 2) {
      if (values[0] !== values[1]) operations.push('−');
      if (Math.max(...values) % Math.min(...values) === 0) operations.push('÷');
    }
    const operation = cells.length === 1 ? '=' : operations[Math.floor(random() * operations.length)];
    const target = operation === '=' ? values[0] : operation === '+' ? values.reduce((sum, value) => sum + value, 0) : operation === '×' ? values.reduce((product, value) => product * value, 1) : operation === '−' ? Math.abs(values[0] - values[1]) : Math.max(...values) / Math.min(...values);
    cages.push({ cells, operation, target });
  }
  const puzzle = { kind: 'cages', seed, difficulty, size, cages, givens: Array(size * size).fill(0), solution };
  function setGivens() {
    puzzle.givens.fill(0);
    cages.filter((cage) => cage.cells.length === 1).forEach((cage) => { puzzle.givens[cage.cells[0]] = cage.target; });
  }
  setGivens();
  // Split ambiguous cages into fixed single-cell clues until uniqueness is proved.
  // This is bounded by the cell count even if a solver's work budget is exhausted.
  for (let attempt = 0; attempt < size * size; attempt++) {
    const result = solve(puzzle);
    if (result.count === 1 && !result.exhausted) break;
    const alternative = result.solutions.find((answer) => answer.some((value, index) => value !== solution[index]));
    // Break an actual ambiguity instead of revealing unrelated cages.
    const candidates = cages.map((cage, index) => ({ cage, index })).filter(({ cage }) => cage.cells.length > 1 && (!alternative || cage.cells.some((index) => alternative[index] !== solution[index])));
    if (!candidates.length) break;
    const fewestCells = Math.min(...candidates.map(({ cage }) => cage.cells.length));
    const smallest = candidates.filter(({ cage }) => cage.cells.length === fewestCells);
    const selected = smallest[Math.floor(random() * smallest.length)];
    const singles = selected.cage.cells.map((index) => ({ cells: [index], operation: '=', target: solution[index] }));
    cages.splice(selected.index, 1, ...singles);
    setGivens();
  }
  return puzzle;
}

export function checkSolution(puzzle, answer) {
  const { size } = puzzle;
  return Array.isArray(answer) && answer.length === size * size && answer.every((value, i) => Number.isInteger(value) && value >= 1 && value <= size && (!puzzle.givens[i] || puzzle.givens[i] === value)) && latinConflicts(answer, size).size === 0 && puzzle.cages.every((cage) => cageSatisfied(cage, cage.cells.map((index) => answer[index])));
}

export function mount(container, { seed = 1, difficulty = 'medium', onComplete, onProgress } = {}) {
  const puzzle = createPuzzle(seed, difficulty);
  const { size } = puzzle;
  return numberInputShell(container, {
    puzzle, size, maxDigit: size, title: 'Cage Logic', onComplete, onProgress,
    instructions: `Use 1–${size} once in every row and column. Each outlined cage must make its corner target using the shown operation. For − and ÷, either order is allowed.`,
    ruleLabel: `${size} × ${size} · no box rule`,
    isComplete: (answer) => checkSolution(puzzle, answer),
    conflicts(answer) {
      const errors = latinConflicts(answer, size);
      for (const cage of puzzle.cages) if (cage.cells.every((index) => answer[index]) && !cageSatisfied(cage, cage.cells.map((index) => answer[index]))) cage.cells.forEach((index) => errors.add(index));
      return errors;
    },
    buildBoard() {
      const board = el('div', 'np-grid');
      board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
      board.setAttribute('aria-label', `${size} by ${size} arithmetic cage board`);
      const cageIds = Array(size * size);
      puzzle.cages.forEach((cage, id) => cage.cells.forEach((index) => { cageIds[index] = id; }));
      const cells = cageIds.map((id, index) => {
        const cell = el('button', 'cell');
        const row = Math.floor(index / size);
        const col = index % size;
        if (row > 0 && cageIds[index - size] !== id) cell.classList.add('np-cage-top');
        if (col > 0 && cageIds[index - 1] !== id) cell.classList.add('np-cage-left');
        if (col < size - 1 && cageIds[index + 1] !== id) cell.classList.add('np-box-right');
        if (row < size - 1 && cageIds[index + size] !== id) cell.classList.add('np-box-bottom');
        const cage = puzzle.cages[id];
        const label = `${cage.target}${cage.operation === '=' ? '' : cage.operation}`;
        cell.title = `Cage target: ${label}`;
        cell.dataset.cageLabel = label;
        if (cage.cells[0] === index) cell.append(el('span', 'np-cage-label', label));
        cell.append(el('span', 'np-cage-value'));
        board.append(cell);
        return cell;
      });
      return { board, cells };
    },
    hintText(answer, selected) {
      const incorrect = answer.findIndex((value, index) => value && value !== puzzle.solution[index]);
      if (incorrect >= 0) return { index: incorrect, text: `Recheck row ${Math.floor(incorrect / size) + 1}, column ${incorrect % size + 1}. That value cannot satisfy all row, column and cage constraints.` };
      const index = selected >= 0 && !answer[selected] ? selected : answer.findIndex((value) => !value);
      const cage = puzzle.cages.find((item) => item.cells.includes(index));
      const label = `${cage.target}${cage.operation === '=' ? '' : cage.operation}`;
      return { index, text: `Try ${puzzle.solution[index]} in row ${Math.floor(index / size) + 1}, column ${index % size + 1}. Its ${label} cage and the row/column restrictions work together; numbers may repeat inside a cage only if they are in different rows and columns.` };
    },
  });
}
