import { _rng, _shuffle, _el, _shell, _button } from './queens.js';

function validDigits(digits) {
  return Array.isArray(digits) && digits.length >= 1 && digits.length <= 6 &&
    Array.from(digits).every(digit => Number.isInteger(digit) && digit >= 1 && digit <= 6) && new Set(digits).size === digits.length;
}

export function feedback(secret, guess) {
  if (!validDigits(secret) || !validDigits(guess) || secret.length !== guess.length) return null;
  const exact = guess.filter((digit, index) => digit === secret[index]).length;
  return { exact, misplaced: guess.filter(digit => secret.includes(digit)).length - exact };
}

export function createPuzzle(seed = 1, difficulty = 'medium') {
  const size = difficulty === 'easy' ? 3 : difficulty === 'hard' ? 5 : 4;
  return { type: 'codebreaker', size, digits: [1, 2, 3, 4, 5, 6], maxAttempts: size * 2 + 2, solution: _shuffle([1, 2, 3, 4, 5, 6], _rng(seed)).slice(0, size), seed, difficulty };
}

export function checkSolution(puzzle, answer) {
  if (!puzzle || ![3, 4, 5].includes(puzzle.size) || puzzle.solution?.length !== puzzle.size || !validDigits(puzzle.solution)) return false;
  return feedback(puzzle.solution, answer)?.exact === puzzle.size;
}

export function mount(container, { seed = 1, difficulty = 'medium', onComplete = () => {}, onProgress = () => {} } = {}) {
  const puzzle = createPuzzle(seed, difficulty);
  const ui = _shell(container, `Crack a ${puzzle.size}-digit secret using digits 1–6, with no repeats. Each guess gives two counts: exact means the correct digit in the correct position; misplaced means a correct digit in a different position. Use the clues together. You have ${puzzle.maxAttempts} guesses.`, puzzle.size);
  ui.board.setAttribute('aria-label', 'Codebreaker controls'); ui.board.style.display = 'block';
  const form = _el('form', { style: 'display:grid;gap:12px' });
  const label = _el('label', { for: 'codebreaker-guess', style: 'font-size:13px;font-weight:600' }, [`Your ${puzzle.size}-digit guess`]);
  const input = _el('input', { id: 'codebreaker-guess', type: 'text', inputmode: 'numeric', autocomplete: 'off', maxlength: puzzle.size, placeholder: `${puzzle.size} different digits`, 'aria-describedby': 'codebreaker-help', style: 'width:100%;box-sizing:border-box;border:1px solid #cdd1df;border-radius:10px;padding:14px;font-family:inherit;font-weight:600;font-size:22px;letter-spacing:.16em;text-align:center;background:white;color:#263046' });
  const help = _el('p', { id: 'codebreaker-help', style: 'font-size:12px;color:var(--muted,#778094);margin:0' }, ['Type digits or tap the keypad, then check your guess. Counts do not identify which digits matched.']);
  const pad = _el('div', { role: 'group', 'aria-label': 'Digit keypad', style: 'display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px' });
  const submit = _el('button', { type: 'submit', class: 'button dark', style: 'justify-content:center' }, ['Check guess']);
  const clues = _el('p', { style: 'font-size:13px;line-height:1.6;margin:16px 0 0', 'aria-live': 'polite' });
  const historyTitle = _el('h3', { style: 'font-size:15px;margin:22px 0 8px' }, ['Your guesses']);
  const history = _el('ol', { 'aria-label': 'Guess history', style: 'list-style:none;padding:0;margin:0;display:grid;gap:8px' });
  const empty = _el('p', { style: 'font-size:13px;color:var(--muted,#778094)' }, ['Your clues will appear here after the first guess.']);
  form.append(label, input, help, pad, submit); ui.board.append(form, clues, historyTitle, empty, history);
  let guesses = [], hints = 0, revealed = 0, won = false, exhausted = false, destroyed = false;
  const digitButtons = puzzle.digits.map(digit => {
    const button = _el('button', { type: 'button', class: 'lg-cell', 'aria-label': `Add digit ${digit}`, style: 'aspect-ratio:1;font-size:20px' }, [String(digit)]);
    ui.listen(button, 'click', () => {
      if (won || exhausted || destroyed) return;
      if (input.value.includes(String(digit))) { ui.say('Every digit must be different. Remove that digit before using it again.'); return; }
      if (input.value.length >= puzzle.size) { ui.say('Your guess is full. Check it or remove a digit.'); return; }
      input.value += digit; input.focus();
    }); pad.append(button); return button;
  });
  ui.listen(form, 'submit', event => { event.preventDefault(); makeGuess(); });
  function makeGuess() {
    if (won || exhausted || destroyed) return;
    const text = input.value.trim();
    if (!new RegExp(`^[1-6]{${puzzle.size}}$`).test(text) || new Set(text).size !== puzzle.size) { ui.say(`Enter exactly ${puzzle.size} different digits from 1 to 6.`); input.focus(); return; }
    const guess = Array.from(text, Number);
    if (guesses.some(previous => previous.guess.every((digit, index) => digit === guess[index]))) { ui.say('You have already tried that code. Use its clues to try a different guess.'); return; }
    const result = feedback(puzzle.solution, guess); guesses.push({ guess, ...result });
    const row = _el('li', { style: 'display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;background:#f5f3fc;border:1px solid #e5e0f5;border-radius:9px;padding:12px;font-size:13px' });
    row.append(_el('span', {}, [`${guesses.length}. `, _el('strong', { style: 'letter-spacing:.22em;font-size:18px' }, [guess.join('')])]), _el('span', {}, [`${result.exact} exact · ${result.misplaced} misplaced`])); history.append(row);
    input.value = ''; won = checkSolution(puzzle, guess); exhausted = !won && guesses.length >= puzzle.maxAttempts;
    update();
    if (won) { ui.say('Secret cracked. Every digit is in the right place.', true); onComplete({ score: Math.max(100, 1800 - guesses.length * 80 - hints * 180), moves: guesses.length, accuracy: 100 }); }
    else if (exhausted) ui.say(`No guesses left. The secret was ${puzzle.solution.join(' ')}. This round is not recorded as a win. Select Restart below to retry, or return to All games for a fresh code.`);
    else { ui.say(`Guess ${guesses.length}: ${result.exact} exact and ${result.misplaced} misplaced. ${puzzle.maxAttempts - guesses.length} guesses remain.`); input.focus(); }
  }
  function update() {
    ui.stats([`${guesses.length} / ${puzzle.maxAttempts} guesses`, `${puzzle.size} distinct digits`, `${revealed} positions revealed`]);
    empty.hidden = guesses.length > 0; input.disabled = submit.disabled = erase.disabled = clear.disabled = won || exhausted;
    digitButtons.forEach(button => { button.disabled = won || exhausted; });
    onProgress({ moves: guesses.length, accuracy: guesses.length ? Math.round(100 * Math.max(...guesses.map(guess => guess.exact)) / puzzle.size) : 0 });
  }
  const erase = _button(ui, 'Remove digit', () => { if (won || exhausted || destroyed) return; input.value = input.value.slice(0, -1); input.focus(); });
  const clear = _button(ui, 'Clear guess', () => { if (won || exhausted || destroyed) return; input.value = ''; input.focus(); });
  update();
  return { destroy() { destroyed = true; input.value = ''; ui.dispose(); }, hint() {
    if (destroyed || won || exhausted) return;
    if (revealed >= puzzle.size) { ui.say('All positions have already been revealed. Enter the code to finish.'); return; }
    hints++; revealed++;
    clues.textContent = `Revealed positions: ${puzzle.solution.slice(0, revealed).map((digit, index) => `${index + 1} → ${digit}`).join(' · ')}. Reveal hints reduce your score.`;
    ui.say(`Position ${revealed} contains ${puzzle.solution[revealed - 1]}. This hint is included in your session.`); update();
  } };
}
