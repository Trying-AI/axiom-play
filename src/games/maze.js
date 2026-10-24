import { rng, shuffled, normalizeDifficulty, el, insertStyles } from './number-shared.js';

function neighbors(index, size) {
  const result = [];
  if (index % size) result.push(index - 1);
  if (index % size < size - 1) result.push(index + 1);
  if (index >= size) result.push(index - size);
  if (index < size * (size - 1)) result.push(index + size);
  return result;
}

export function applyStep(value, cell) {
  let next;
  if (cell.op === '+') next = value + cell.value;
  else if (cell.op === '−') next = value - cell.value;
  else if (cell.op === '×') next = value * cell.value;
  else if (cell.op === '÷') next = cell.value && value % cell.value === 0 ? value / cell.value : NaN;
  else return NaN;
  return Number.isSafeInteger(next) && Math.abs(next) <= 1000000 ? next : NaN;
}

export function pathValue(puzzle, path) {
  if (!Array.isArray(path) || !path.length || path[0] !== puzzle.start || new Set(path).size !== path.length) return NaN;
  let value = puzzle.startValue;
  for (let step = 0; step < path.length; step++) {
    const index = path[step];
    if (!Number.isInteger(index) || index < 0 || index >= puzzle.board.length || puzzle.board[index].blocked) return NaN;
    if (!step) continue;
    if (!neighbors(path[step - 1], puzzle.size).includes(index)) return NaN;
    value = applyStep(value, puzzle.board[index]);
    if (!Number.isFinite(value)) return NaN;
  }
  return value;
}

export function createPuzzle(seed = 1, difficulty = 'medium') {
  difficulty = normalizeDifficulty(difficulty);
  const random = rng(seed);
  const size = { easy: 4, medium: 5, hard: 6 }[difficulty];
  const start = 0;
  const end = size * size - 1;
  const solution = [start];
  const visited = new Set(solution);
  const minimumLength = size * 2 - 1;
  const maximumLength = minimumLength + (difficulty === 'easy' ? 2 : 6);
  let nodes = 0;
  function route(current) {
    if (++nodes > 10000) return false;
    if (current === end) return solution.length >= minimumLength;
    const distance = size - 1 - Math.floor(current / size) + size - 1 - current % size;
    if (solution.length + distance > maximumLength) return false;
    for (const next of shuffled(neighbors(current, size), random)) {
      if (visited.has(next)) continue;
      visited.add(next);
      solution.push(next);
      if (route(next)) return true;
      visited.delete(next);
      solution.pop();
    }
    return false;
  }
  if (!route(start)) {
    // Bounded fallback creates a seeded monotonic route to the same destination.
    solution.splice(0, solution.length, start);
    let current = start;
    while (current !== end) {
      const possible = [];
      if (current % size < size - 1) possible.push(current + 1);
      if (current < size * (size - 1)) possible.push(current + size);
      current = possible[Math.floor(random() * possible.length)];
      solution.push(current);
    }
  }
  const solutionCells = new Set(solution);
  const startValue = 2 + Math.floor(random() * 8);
  const board = Array.from({ length: size * size }, (_, index) => {
    const operation = difficulty === 'easy' ? ['+', '−'] : ['+', '−', '×', '÷'];
    const op = operation[Math.floor(random() * operation.length)];
    return { op, value: op === '×' || op === '÷' ? 2 + Math.floor(random() * 2) : 1 + Math.floor(random() * 9), blocked: !solutionCells.has(index) && random() < .28 };
  });
  board[start] = { op: 'start', value: startValue, blocked: false };
  let total = startValue;
  for (const index of solution.slice(1)) {
    let cell = board[index];
    let next = applyStep(total, cell);
    if (!Number.isFinite(next) || next < 0 || next > 200) {
      cell = { op: total > 100 ? '−' : '+', value: 1 + Math.floor(random() * 9), blocked: false };
      board[index] = cell;
      next = applyStep(total, cell);
    }
    total = next;
  }
  if (total === startValue) {
    const beforeLast = solution.slice(0, -1).reduce((value, index, position) => position ? applyStep(value, board[index]) : startValue, startValue);
    board[end] = { op: '+', value: beforeLast + 1 === startValue ? 2 : 1, blocked: false };
    total = applyStep(beforeLast, board[end]);
  }
  return { kind: 'maze', seed, difficulty, size, start, end, startValue, target: total, board, solution };
}

export function checkSolution(puzzle, answer) {
  return Array.isArray(answer) && answer.length > 1 && answer[answer.length - 1] === puzzle.end && pathValue(puzzle, answer) === puzzle.target;
}

export function mount(container, { seed = 1, difficulty = 'medium', onComplete, onProgress } = {}) {
  insertStyles();
  const puzzle = createPuzzle(seed, difficulty);
  const wrap = el('div', 'np-wrap');
  wrap.tabIndex = 0;
  wrap.setAttribute('aria-label', 'Math Maze');
  const instruction = el('p', 'game-instruction', 'Reach the purple finish with exactly the target total. Move up, down, left or right; apply each tile immediately in path order. No repeated tiles, and division must give a whole number.');
  const stats = el('div', 'np-status');
  const currentStat = el('span', 'stat-pill');
  const targetStat = el('span', 'stat-pill', `Target: ${puzzle.target}`);
  const stepsStat = el('span', 'stat-pill');
  stats.append(currentStat, targetStat, stepsStat);
  const board = el('div', 'game-board np-maze');
  board.style.gridTemplateColumns = `repeat(${puzzle.size}, 1fr)`;
  board.setAttribute('aria-label', `${puzzle.size} by ${puzzle.size} arithmetic maze`);
  const cells = puzzle.board.map((cell, index) => {
    const button = el('button', `cell${cell.blocked ? ' np-blocked' : ''}${index === puzzle.end ? ' np-goal' : ''}`);
    button.type = 'button';
    button.disabled = cell.blocked;
    if (index === puzzle.start || index === puzzle.end) button.append(el('small', '', index === puzzle.start ? 'Start' : 'Finish'));
    button.append(el('span', '', cell.blocked ? '·' : index === puzzle.start ? cell.value : `${cell.op}${cell.value}`));
    const marker = el('span', 'np-maze-step');
    button.append(marker);
    button.setAttribute('aria-label', `Row ${Math.floor(index / puzzle.size) + 1}, column ${index % puzzle.size + 1}: ${cell.blocked ? 'blocked' : index === puzzle.start ? `start at ${cell.value}` : `${cell.op} ${cell.value}`}${index === puzzle.end ? ', finish' : ''}`);
    board.append(button);
    return button;
  });
  const expression = el('div', 'np-expression');
  expression.setAttribute('aria-label', 'Your calculation path');
  const controls = el('div', 'game-controls');
  const undo = el('button', 'button secondary', 'Undo step');
  const reset = el('button', 'button secondary', 'Back to start');
  undo.type = reset.type = 'button';
  controls.append(undo, reset);
  const message = el('p', 'game-message', 'Tap a neighboring tile or use the arrow keys. Tap an earlier path tile to backtrack.');
  message.setAttribute('aria-live', 'polite');
  wrap.append(instruction, stats, board, expression, controls, message);
  container.replaceChildren(wrap);
  const path = [puzzle.start];
  let moves = 0;
  let mistakes = 0;
  let completed = false;
  let destroyed = false;
  const listeners = [];
  function listen(target, type, handler) { target.addEventListener(type, handler); listeners.push(() => target.removeEventListener(type, handler)); }
  function accuracy() { return moves ? Math.round((moves - mistakes) / moves * 100) : 100; }
  function render() {
    const current = pathValue(puzzle, path);
    currentStat.textContent = `Current: ${current}`;
    stepsStat.textContent = `${path.length - 1} steps`;
    cells.forEach((cell, index) => {
      const position = path.indexOf(index);
      cell.classList.toggle('np-path', position >= 0);
      cell.classList.toggle('np-current', path[path.length - 1] === index);
      cell.setAttribute('aria-pressed', String(position >= 0));
      cell.querySelector('.np-maze-step').textContent = position >= 0 ? position : '';
    });
    // Show explicit running totals so sequential evaluation cannot be mistaken for precedence.
    let running = puzzle.startValue;
    const steps = [String(running)];
    for (const index of path.slice(1)) { const cell = puzzle.board[index]; running = applyStep(running, cell); steps.push(`${cell.op}${cell.value} → ${running}`); }
    expression.textContent = steps.join('  ·  ');
    undo.disabled = path.length === 1 || completed;
    reset.disabled = path.length === 1 || completed;
    onProgress?.({ moves, accuracy: accuracy(), filled: path.length - 1, total: puzzle.solution.length - 1, current, target: puzzle.target });
  }
  function move(index) {
    if (completed || destroyed) return;
    const previous = path.indexOf(index);
    if (previous >= 0) {
      path.splice(previous + 1);
      message.textContent = 'Backtracked. Try another route to the target.';
      render();
      return;
    }
    if (index < 0 || index >= puzzle.board.length || puzzle.board[index].blocked || !neighbors(path[path.length - 1], puzzle.size).includes(index)) {
      message.textContent = 'Choose an open tile directly beside your current position.';
      return;
    }
    moves++;
    const value = applyStep(pathValue(puzzle, path), puzzle.board[index]);
    if (!Number.isFinite(value)) {
      mistakes++;
      message.textContent = 'This move would produce a fraction or exceed the board limit. Choose a different tile.';
      render();
      return;
    }
    path.push(index);
    message.textContent = `Current total: ${value}. Keep aiming for ${puzzle.target}.`;
    if (checkSolution(puzzle, path)) {
      completed = true;
      message.textContent = `Route complete! You reached ${puzzle.target} in ${path.length - 1} steps.`;
      message.classList.add('np-success');
    } else if (index === puzzle.end) {
      mistakes++;
      message.textContent = `You reached the finish with ${value}; the target is ${puzzle.target}. Undo a step and try another route.`;
    }
    render();
    if (completed) onComplete?.({ score: Math.max(100, 1100 - moves * 5 - mistakes * 25), moves, accuracy: accuracy() });
  }
  cells.forEach((cell, index) => listen(cell, 'click', () => move(index)));
  listen(undo, 'click', () => { if (path.length > 1) move(path[path.length - 2]); });
  listen(reset, 'click', () => move(puzzle.start));
  listen(wrap, 'keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || completed) return;
    const current = path[path.length - 1];
    const direction = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -puzzle.size, ArrowDown: puzzle.size }[event.key];
    if (direction) { event.preventDefault(); move(current + direction); }
    else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); if (path.length > 1) move(path[path.length - 2]); }
  });
  render();
  return {
    destroy() { destroyed = true; listeners.forEach((remove) => remove()); container.replaceChildren(); },
    hint() {
      if (completed || destroyed) return 'The maze is already solved.';
      let shared = 0;
      while (shared < path.length && path[shared] === puzzle.solution[shared]) shared++;
      let text;
      if (shared < path.length) {
        const index = puzzle.solution[Math.max(0, shared - 1)];
        text = `One guaranteed route branches from row ${Math.floor(index / puzzle.size) + 1}, column ${index % puzzle.size + 1}. Tap that earlier tile to backtrack.`;
      } else {
        const index = puzzle.solution[path.length];
        const cell = puzzle.board[index];
        text = `Try row ${Math.floor(index / puzzle.size) + 1}, column ${index % puzzle.size + 1}: ${cell.op}${cell.value}. That changes your current total to ${applyStep(pathValue(puzzle, path), cell)} on a route to ${puzzle.target}.`;
      }
      message.textContent = text;
      return text;
    },
  };
}
