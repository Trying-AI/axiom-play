// Small shared primitives. All generation is local and deterministic; no runtime dependencies.
export function rng(seed = 1) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let n = Math.imul(value ^ (value >>> 15), value | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = String(text);
  return node;
}

export function normalizeDifficulty(value) {
  return value === 'easy' || value === 'hard' ? value : 'medium';
}

export function insertStyles() {
  if (document.getElementById('number-puzzle-styles')) return;
  const style = el('style');
  style.id = 'number-puzzle-styles';
  style.textContent = `
    .np-wrap{width:100%;max-width:620px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:18px;outline:none}
    .np-wrap .game-instruction{text-align:center;max-width:510px;line-height:1.65;font-size:13px;color:#657087;margin:0}
    .np-grid{display:grid;width:min(100%,430px);gap:0;overflow:hidden;border:2px solid #77839a;border-radius:14px;background:#d8dde7;box-sizing:border-box}
    .np-grid .cell{position:relative;min-width:0;min-height:0;aspect-ratio:1;border:0;border-right:1px solid #d8dde7;border-bottom:1px solid #d8dde7;border-radius:0;background:#fff;color:#514ec2;font-family:inherit;font-size:clamp(18px,4vw,28px);font-weight:600;line-height:1;cursor:pointer;transition:background .12s,color .12s;display:grid;place-content:center;padding:0}
    .np-grid .cell:hover{background:#f4f2ff}.np-grid .cell.given{background:#f3f4f8;color:#364158;cursor:default}
    .np-grid .cell.selected{background:#eeebff;color:#443da7;box-shadow:inset 0 0 0 2px #7b73d7;z-index:1}
    .np-grid .cell.error{color:#b53950;background:#fff0f3}.np-grid .cell:focus-visible,.np-pad button:focus-visible{outline:3px solid #6156be;outline-offset:-4px;z-index:3}
    .np-grid .np-box-right{border-right:2px solid #8790a3}.np-grid .np-box-bottom{border-bottom:2px solid #8790a3}
    .np-cage-label{position:absolute;top:5px;left:6px;font-size:clamp(9px,2vw,12px);font-weight:700;line-height:1;color:#526078;pointer-events:none}
    .np-cage-value{padding-top:8px;pointer-events:none}.np-grid .np-cage-top{border-top:2px solid #8790a3}.np-grid .np-cage-left{border-left:2px solid #8790a3}
    .np-pad{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;width:100%}.np-pad button{min-width:38px;min-height:43px;border:1px solid #d9dcea;border-radius:9px;background:#f5f4fb;color:#4f4a9f;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer}.np-pad button:hover{background:#e8e4fb}.np-pad button.np-used{opacity:.45}
    .np-wrap .game-controls{display:flex;flex-wrap:wrap;gap:9px;justify-content:center}.np-wrap .game-message{min-height:42px;text-align:center;font-size:13px;line-height:1.55;color:#657087;margin:0;max-width:520px}.np-wrap .game-message.np-success{color:#21795a}
    .np-status{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}.np-status .stat-pill{font-size:12px;border:1px solid #e1e1ee;border-radius:999px;padding:7px 11px;background:#f7f6fb;color:#605d80}
    .np-cross{display:grid;grid-template-columns:1fr .33fr 1fr .33fr 1fr .3fr .82fr;grid-template-rows:1fr .35fr 1fr .35fr 1fr .3fr .65fr;width:min(100%,480px);aspect-ratio:1.08;gap:3px;align-items:stretch;justify-items:stretch}
    .np-cross .cell{border:1px solid #d4d8e3;border-radius:11px;background:#fff;color:#514ec2;font-family:inherit;font-size:clamp(18px,4vw,30px);font-weight:600;cursor:pointer;min-width:0;min-height:0;aspect-ratio:auto;padding:0}.np-cross .cell.given{background:#f3f4f8;color:#364158}.np-cross .cell.selected{background:#eeebff;border-color:#7b73d7;box-shadow:0 0 0 1px #7b73d7}.np-cross .cell.error{color:#b53950;border-color:#bf697b}
    .np-cross-token{display:grid;place-content:center;color:#707b8e;font-size:clamp(14px,3vw,21px)}.np-cross-target{border-radius:10px;background:#eaf5ee;color:#28684c;font-weight:700}.np-cross .cell:focus-visible{outline:3px solid #6156be;outline-offset:2px}
    .np-maze{display:grid;width:min(100%,460px);gap:7px}.np-maze .cell{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;aspect-ratio:1;border:1px solid #d7dce5;border-radius:12px;background:#fff;color:#46536b;font-family:inherit;font-size:clamp(14px,3vw,20px);font-weight:600;padding:3px;cursor:pointer}.np-maze .cell small{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#64728a;margin-bottom:4px}.np-maze .np-blocked{background:#f0f1f5;border-color:#e6e7ed;color:#b7bdc9;cursor:default}.np-maze .np-path{background:#e8f4ec;border-color:#8cb49c;color:#28684c}.np-maze .np-current{background:#cfe9da;border-color:#51946d;box-shadow:0 0 0 2px #6baf8933}.np-maze .np-goal{border:2px solid #9b7bce;background:#f6f1fc}.np-maze .np-goal.np-current{background:#dceede}.np-maze .cell:focus-visible{outline:3px solid #6156be;outline-offset:2px}.np-maze-step{position:absolute;top:4px;right:5px;font:10px ui-monospace,monospace;color:#417956}
    .np-expression{width:100%;max-width:460px;min-height:48px;border:1px solid #e0e4ec;border-radius:10px;background:#f7f8fb;padding:12px;box-sizing:border-box;text-align:center;font:13px/1.8 ui-monospace,monospace;color:#5d6980;overflow-wrap:anywhere}
    @media(max-width:420px){.np-wrap{gap:14px}.np-pad{gap:5px}.np-pad button{min-width:33px;min-height:40px}.np-cage-label{top:4px;left:4px}.np-maze{gap:5px}.np-maze .cell{border-radius:8px}}
    @media(prefers-reduced-motion:reduce){.np-grid .cell{transition:none}}
  `;
  document.head.append(style);
}

// Shared input shell used by the three numeric-grid games. There are no background timers.
export function numberInputShell(container, options) {
  insertStyles();
  const { puzzle, size, title, buildBoard, isComplete, conflicts = () => new Set(), hintText, onComplete, onProgress } = options;
  const answer = [...puzzle.givens];
  const wrap = el('div', 'np-wrap');
  wrap.tabIndex = 0;
  wrap.setAttribute('aria-label', title);
  const instruction = el('p', 'game-instruction', options.instructions);
  const stats = el('div', 'np-status');
  const remaining = el('span', 'stat-pill');
  const rule = el('span', 'stat-pill', options.ruleLabel);
  stats.append(remaining, rule);
  const { board, cells, update } = buildBoard(puzzle);
  const valueNodes = cells.map((cell) => cell.querySelector('.np-cage-value') || cell);
  board.classList.add('game-board');
  const keypad = el('div', 'number-pad np-pad');
  keypad.setAttribute('aria-label', 'Number keypad');
  const controls = el('div', 'game-controls');
  const erase = el('button', 'button secondary', 'Erase');
  erase.type = 'button';
  const reset = el('button', 'button secondary', 'Reset board');
  reset.type = 'button';
  controls.append(erase, reset);
  const message = el('p', 'game-message', 'Select a cell, then use the number keys or the keypad.');
  message.setAttribute('aria-live', 'polite');
  wrap.append(instruction, stats, board, keypad, controls, message);
  container.replaceChildren(wrap);
  let selected = answer.findIndex((value) => !value);
  let moves = 0;
  let mistakes = 0;
  let completed = false;
  let destroyed = false;
  const listeners = [];
  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };
  function accuracy() { return moves ? Math.round((moves - mistakes) / moves * 100) : 100; }
  function render() {
    if (destroyed) return;
    const errors = conflicts(answer);
    cells.forEach((cell, index) => {
      const value = valueNodes[index];
      const text = answer[index] ? String(answer[index]) : '';
      if (value.textContent !== text) value.textContent = text;
      cell.classList.toggle('selected', index === selected);
      cell.classList.toggle('given', Boolean(puzzle.givens[index]));
      cell.classList.toggle('error', errors.has(index));
      cell.setAttribute('aria-label', `Row ${Math.floor(index / size) + 1}, column ${index % size + 1}, ${answer[index] || 'empty'}${puzzle.givens[index] ? ', given' : ''}${cell.dataset.cageLabel ? `, cage target ${cell.dataset.cageLabel}` : ''}`);
      cell.setAttribute('aria-pressed', String(index === selected));
      cell.tabIndex = index === selected ? 0 : -1;
    });
    const filled = answer.filter(Boolean).length;
    remaining.textContent = `${filled} / ${answer.length} filled`;
    if (update) update(answer);
    onProgress?.({ moves, accuracy: accuracy(), filled, total: answer.length });
  }
  function enter(value) {
    if (destroyed || completed || selected < 0) return;
    if (puzzle.givens[selected]) { message.textContent = 'This is a given clue. Choose an empty cell.'; return; }
    if (answer[selected] === value) return;
    if (value) { moves++; if (value !== puzzle.solution[selected]) mistakes++; }
    answer[selected] = value;
    message.textContent = value ? 'Keep going. Every row and column must satisfy the rules.' : 'Cell cleared.';
    render();
    if (isComplete(answer)) {
      completed = true;
      erase.disabled = reset.disabled = true;
      message.textContent = options.successMessage || 'Perfectly solved. Every constraint checks out.';
      message.classList.add('np-success');
      onComplete?.({ score: Math.max(100, 1000 - mistakes * 30), moves, accuracy: accuracy() });
    } else if (answer.every(Boolean)) {
      message.textContent = 'The board is full, but some constraints are not satisfied. Check your entries.';
    }
  }
  cells.forEach((cell, index) => {
    cell.type = 'button';
    listen(cell, 'click', () => { selected = index; render(); });
    listen(cell, 'focus', () => { if (selected !== index) { selected = index; render(); } });
  });
  for (let value = 1; value <= options.maxDigit; value++) {
    const button = el('button', '', value);
    button.type = 'button';
    button.setAttribute('aria-label', `Enter ${value}`);
    listen(button, 'click', () => enter(value));
    keypad.append(button);
  }
  listen(erase, 'click', () => enter(0));
  listen(reset, 'click', () => {
    if (completed) return;
    answer.splice(0, answer.length, ...puzzle.givens);
    selected = answer.findIndex((value) => !value);
    message.textContent = 'Board reset. Your attempt count is retained.';
    render();
  });
  listen(wrap, 'keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || completed) return;
    const digit = Number(event.key);
    if (/^[1-9]$/.test(event.key) && digit <= options.maxDigit) { event.preventDefault(); enter(digit); }
    else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') { event.preventDefault(); enter(0); }
    else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      const direction = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[event.key];
      if (direction) {
        const next = selected + direction;
        const sameRow = Math.floor(next / size) === Math.floor(selected / size);
        if (next >= 0 && next < answer.length && (Math.abs(direction) === size || sameRow)) selected = next;
        render();
        cells[selected].focus({ preventScroll: true });
      }
    }
  });
  render();
  return {
    destroy() { destroyed = true; listeners.forEach((remove) => remove()); container.replaceChildren(); },
    hint() {
      if (completed || destroyed) return 'This puzzle is already solved.';
      const hint = hintText(answer, selected);
      if (hint.index !== undefined) selected = hint.index;
      message.textContent = hint.text;
      render();
      return hint.text;
    },
  };
}

export function latinConflicts(answer, size, boxes = false) {
  const errors = new Set();
  const groups = [];
  for (let i = 0; i < size; i++) {
    groups.push(Array.from({ length: size }, (_, j) => i * size + j));
    groups.push(Array.from({ length: size }, (_, j) => j * size + i));
  }
  if (boxes) {
    for (let row = 0; row < 6; row += 2) for (let col = 0; col < 6; col += 3) {
      groups.push([row * 6 + col, row * 6 + col + 1, row * 6 + col + 2, (row + 1) * 6 + col, (row + 1) * 6 + col + 1, (row + 1) * 6 + col + 2]);
    }
  }
  for (const group of groups) {
    const seen = new Map();
    for (const index of group) {
      const value = answer[index];
      if (!value) continue;
      if (seen.has(value)) { errors.add(index); errors.add(seen.get(value)); }
      else seen.set(value, index);
    }
  }
  return errors;
}
