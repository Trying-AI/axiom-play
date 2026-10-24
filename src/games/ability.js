import {randomSource, element, button, level, sessionUI} from './memory-common.js';

export const SKILLS = ['hcf', 'lcm', 'exponent', 'root', 'modulus', 'primefactors', 'sumsquares'];

export function gcd(a, b) {
  while (b !== 0) [a, b] = [b, a % b];
  return Math.abs(a);
}

function factorize(value) {
  const factors = [];
  for (let divisor = 2; divisor * divisor <= value; divisor++) {
    while (value % divisor === 0) {factors.push(divisor); value /= divisor;}
  }
  if (value > 1) factors.push(value);
  return factors;
}

export function createPuzzle(seed, difficulty = 'medium') {
  const random = randomSource(seed);
  const rank = ['easy', 'medium', 'hard'].indexOf(level(difficulty));
  const integer = (minimum, maximum) => minimum + Math.floor(random() * (maximum - minimum + 1));
  const skill = SKILLS[(seed >>> 0) % SKILLS.length];
  const puzzle = {kind: 'ability', skill};
  if (skill === 'hcf' || skill === 'lcm') {
    const common = integer(2, 5 + rank * 3);
    const a = common * integer(2, 6 + rank * 3);
    let b = common * integer(3, 7 + rank * 3);
    if (a === b) b += common;
    const divisor = gcd(a, b);
    puzzle.values = [a, b];
    puzzle.label = skill === 'hcf' ? 'Highest common factor' : 'Least common multiple';
    puzzle.prompt = `${skill.toUpperCase()} of ${a} and ${b}?`;
    puzzle.solution = skill === 'hcf' ? divisor : a / divisor * b;
    puzzle.explanation = skill === 'hcf' ? `${a} = ${divisor} × ${a / divisor}; ${b} = ${divisor} × ${b / divisor}. Their largest shared factor is ${divisor}.` : `LCM(a, b) = a × b ÷ HCF(a, b). Here, ${a} × ${b} ÷ ${divisor} = ${puzzle.solution}.`;
    puzzle.hint = skill === 'hcf' ? 'Look for a number that divides both values exactly. Start with small shared prime factors.' : 'Find the highest common factor first, then multiply the two values and divide by that factor.';
  } else if (skill === 'exponent') {
    const base = integer(2, 6 + rank * 3), exponent = integer(2, 3 + rank);
    puzzle.label = 'Exponents';
    puzzle.values = [base, exponent];
    puzzle.prompt = `${base}${String(exponent).replace(/\d/g, digit => '⁰¹²³⁴⁵⁶⁷⁸⁹'[digit])} = ?`;
    puzzle.solution = base ** exponent;
    puzzle.explanation = `Multiply ${base} by itself ${exponent} times: ${Array(exponent).fill(base).join(' × ')} = ${puzzle.solution}.`;
    puzzle.hint = 'Multiply the base by itself as many times as the exponent says. Reuse squared values when you can.';
  } else if (skill === 'root') {
    const root = integer(3, 9 + rank * 3), degree = integer(2, 2 + rank);
    puzzle.label = 'Exact roots';
    puzzle.values = [root ** degree, degree];
    puzzle.prompt = `${degree === 2 ? 'Square' : degree === 3 ? 'Cube' : 'Fourth'} root of ${root ** degree}?`;
    puzzle.solution = root;
    puzzle.explanation = `${root}${String(degree).replace(/\d/g, digit => '⁰¹²³⁴⁵⁶⁷⁸⁹'[digit])} = ${root ** degree}, so the positive ${degree === 2 ? 'square' : degree === 3 ? 'cube' : 'fourth'} root is ${root}.`;
    puzzle.hint = `Find a positive integer that, multiplied by itself ${degree} times, produces the displayed value.`;
  } else if (skill === 'modulus') {
    const divisor = integer(3, 10 + rank * 9), value = integer(40, 150 + rank * 650);
    puzzle.label = 'Remainders';
    puzzle.values = [value, divisor];
    puzzle.prompt = `${value} mod ${divisor} = ?`;
    puzzle.solution = value % divisor;
    puzzle.explanation = `${value} = ${divisor} × ${Math.floor(value / divisor)} + ${puzzle.solution}. The remainder is ${puzzle.solution}.`;
    puzzle.hint = 'Find the largest multiple of the divisor that does not exceed the first number. Subtract that multiple.';
  } else if (skill === 'primefactors') {
    const primes = [2, 3, 5, 7, 11].slice(0, 3 + rank);
    const factors = Array.from({length: 3 + rank}, () => primes[integer(0, primes.length - 1)]).sort((a, b) => a - b);
    const value = factors.reduce((product, n) => product * n, 1);
    puzzle.label = 'Prime factorization';
    puzzle.values = [value];
    puzzle.prompt = `Prime factors of ${value}?`;
    puzzle.solution = factorize(value);
    puzzle.explanation = `${value} = ${puzzle.solution.join(' × ')}. Each factor is prime; repeated factors are included.`;
    puzzle.hint = 'Divide by the smallest possible prime, starting with 2, then 3, 5, 7… Repeat a prime as often as it divides evenly.';
  } else {
    const n = integer(3 + rank * 2, 7 + rank * 5);
    puzzle.label = 'Sum of squares';
    puzzle.values = [n];
    puzzle.prompt = `1² + 2² + … + ${n}² = ?`;
    puzzle.solution = n * (n + 1) * (2 * n + 1) / 6;
    puzzle.explanation = `1² + … + n² = n(n + 1)(2n + 1) ÷ 6. For n = ${n}: ${n} × ${n + 1} × ${2 * n + 1} ÷ 6 = ${puzzle.solution}.`;
    puzzle.hint = 'Use the formula n(n + 1)(2n + 1) ÷ 6. Divide out the 6 before multiplying to keep the numbers small.';
  }
  return puzzle;
}

export function checkSolution(puzzle, answer) {
  if (puzzle.skill === 'primefactors') {
    let factors;
    if (Array.isArray(answer)) factors = [...answer];
    else if (typeof answer === 'string' && answer.trim()) {
      const tokens = answer.trim().split(/[\s,*×x·]+/i);
      if (tokens.some(token => !/^\d+$/.test(token))) return false;
      factors = tokens.map(Number);
    } else return false;
    if (factors.some(n => !Number.isSafeInteger(n) || n < 2)) return false;
    const target = factorize(puzzle.values[0]);
    factors.sort((a, b) => a - b);
    return factors.length === target.length && factors.every((factor, index) => factor === target[index]);
  }
  if (typeof answer === 'string' && !/^\d+$/.test(answer.trim())) return false;
  if (typeof answer !== 'number' && typeof answer !== 'string') return false;
  return Number.isSafeInteger(Number(answer)) && Number(answer) === puzzle.solution;
}

export function mount(container, options = {}) {
  const {seed = 1, difficulty = 'medium'} = options;
  const ui = sessionUI(container, options, 'Ability Lab', 'Seven questions cover factors, multiples, powers, roots, remainders, prime factorization and sums of squares. Type an answer and press Enter. Review the explanation before moving on.', 7);
  let round = 0, correct = 0, moves = 0, state = 'answer', puzzle, input;

  function renderRound() {
    if (ui.destroyed) return;
    state = 'answer';
    puzzle = createPuzzle(((seed >>> 0) % 1000000) + round, difficulty);
    ui.progress(round, correct, moves);
    ui.phase.textContent = puzzle.label;
    const isFactors = puzzle.skill === 'primefactors';
    input = element('input', {type: 'text', inputMode: isFactors ? 'text' : 'numeric', placeholder: isFactors ? 'e.g. 2, 2, 3' : 'Your answer', autoComplete: 'off', 'aria-label': isFactors ? 'Prime factors, separated by commas' : 'Your answer'});
    const form = element('form', {onSubmit: event => {event.preventDefault(); submit();}}, [element('div', {className: 'mem-prompt'}, puzzle.prompt), input, isFactors ? element('div', {className: 'mem-subtle'}, 'List every prime factor, including repeats. Separate them with commas or ×.') : null, element('button', {className: 'button', type: 'submit'}, 'Check answer')]);
    ui.board.replaceChildren(form);
    ui.controls.replaceChildren();
    ui.feedback.textContent = 'Take your time. Accuracy builds fluency.';
  }

  function submit() {
    if (state !== 'answer') return;
    const value = input.value.trim();
    const valid = puzzle.skill === 'primefactors' ? /^\d+(?:[\s,*×x·]+\d+)*$/i.test(value) : /^\d+$/.test(value);
    if (!valid) {ui.feedback.textContent = puzzle.skill === 'primefactors' ? 'Enter prime factors separated by commas, spaces or ×, including repeated factors.' : 'Enter a non-negative whole number.'; return;}
    state = 'review';
    moves++;
    const success = checkSolution(puzzle, value);
    if (success) correct++;
    const expected = Array.isArray(puzzle.solution) ? puzzle.solution.join(' × ') : String(puzzle.solution);
    ui.phase.textContent = success ? 'Correct' : 'Review';
    ui.board.replaceChildren(element('div', {className: 'mem-prompt'}, puzzle.prompt), element('div', {className: 'mem-prompt'}, expected), element('p', {className: 'mem-equation'}, puzzle.explanation));
    ui.feedback.textContent = success ? 'Correct. Review the method, then continue.' : `Your answer: ${value}. Correct answer: ${expected}.`;
    ui.progress(round, correct, moves);
    ui.controls.replaceChildren(button(round === 6 ? 'Finish session' : 'Next question', () => {
      round++;
      if (round === 7) ui.finish(correct, moves, correct * 150);
      else renderRound();
    }));
  }

  renderRound();
  return {destroy: () => ui.destroy(), hint() {ui.feedback.textContent = puzzle.hint;}};
}
