export function element(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value != null) node.setAttribute(name === 'className' ? 'class' : name, String(value));
  }
  for (const child of children) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}

export function numericBoard(value, length, max) {
  return Array.isArray(value) && value.length === length && Array.from(value).every(n => Number.isInteger(n) && n >= 0 && n <= max);
}

export function moveFocus(event, buttons, size) {
  const index = buttons.indexOf(document.activeElement);
  if (index < 0) return;
  const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -size, ArrowDown: size }[event.key];
  if (delta === undefined) return;
  event.preventDefault();
  const next = Math.max(0, Math.min(buttons.length - 1, index + delta));
  buttons[next].focus();
}

export function listenScope() {
  const cleanup = [];
  return {
    on(node, event, listener) { node.addEventListener(event, listener); cleanup.push(() => node.removeEventListener(event, listener)); },
    destroy() { cleanup.splice(0).forEach(fn => fn()); },
  };
}
