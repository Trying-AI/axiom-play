export function createRng(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function shuffle(array, random = Math.random) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function make(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name.startsWith('on') && typeof value === 'function') element.addEventListener(name.slice(2).toLowerCase(), value);
    else if (name === 'dataset') Object.assign(element.dataset, value);
    else if (name === 'style' && typeof value === 'object') Object.assign(element.style, value);
    else if (name in element && !name.startsWith('aria')) element[name] = value;
    else if (value != null && value !== false) element.setAttribute(name, value === true ? '' : value);
  }
  for (const child of [children].flat(Infinity)) {
    if (child != null) element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

export function hashSeed(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
