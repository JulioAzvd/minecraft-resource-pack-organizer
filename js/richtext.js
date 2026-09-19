const MC_COLORS = [
  { code: '0', name: 'Black', hex: '#000000', background: '#000000' },
  { code: '1', name: 'Dark blue', hex: '#0000AA', background: '#00002A' },
  { code: '2', name: 'Dark green', hex: '#00AA00', background: '#002A00' },
  { code: '3', name: 'Dark aqua', hex: '#00AAAA', background: '#002A2A' },
  { code: '4', name: 'Dark red', hex: '#AA0000', background: '#2A0000' },
  { code: '5', name: 'Dark purple', hex: '#AA00AA', background: '#2A002A' },
  { code: '6', name: 'Gold', hex: '#FFAA00', background: '#3E2A00' },
  { code: '7', name: 'Gray', hex: '#AAAAAA', background: '#2A2A2A' },
  { code: '8', name: 'Dark gray', hex: '#555555', background: '#151515' },
  { code: '9', name: 'Blue', hex: '#5555FF', background: '#15153F' },
  { code: 'a', name: 'Green', hex: '#55FF55', background: '#153F15' },
  { code: 'b', name: 'Aqua', hex: '#55FFFF', background: '#153F3F' },
  { code: 'c', name: 'Red', hex: '#FF5555', background: '#3F1515' },
  { code: 'd', name: 'Light purple', hex: '#FF55FF', background: '#3F153F' },
  { code: 'e', name: 'Yellow', hex: '#FFFF55', background: '#3F3F15' },
  { code: 'f', name: 'White', hex: '#FFFFFF', background: '#3F3F3F' },
  { code: 'g', name: 'Minecoin gold', hex: '#DDD605', background: '#373501' },
  { code: 'h', name: 'Material quartz', hex: '#E3D4D1', background: '#383534' },
  { code: 'i', name: 'Material iron', hex: '#CECACA', background: '#333232' },
  { code: 'j', name: 'Material netherite', hex: '#443A3B', background: '#110E0E' },
  { code: 'm', name: 'Material redstone', hex: '#971607', background: '#250501' },
  { code: 'n', name: 'Material copper', hex: '#B4684D', background: '#2D1A13' },
  { code: 'p', name: 'Material gold', hex: '#DEB12D', background: '#372C0B' },
  { code: 'q', name: 'Material emerald', hex: '#119F36', background: '#04280D' },
  { code: 's', name: 'Material diamond', hex: '#2CBAA8', background: '#0B2E2A' },
  { code: 't', name: 'Material lapis', hex: '#21497B', background: '#08121E' },
  { code: 'y', name: 'Material amethyst', hex: '#9A5CC6', background: '#261731' },
  { code: 'v', name: 'Material resin', hex: '#EB7114', background: '#3B1D05' },
  { code: 'w', name: 'Party blue', hex: '#8CB3FF', background: '#232D40' },
];

const MC_FORMATS = {
  k: 'obfuscated',
  l: 'bold',
  m: 'strikethrough',
  n: 'underline',
  o: 'italic',
};

const MC_COLOR_BY_CODE = Object.fromEntries(MC_COLORS.map((color) => [color.code, color.hex]));
const MC_CODE_BY_COLOR = Object.fromEntries(MC_COLORS.map((color) => [color.hex.toLowerCase(), color.code]));
const OBFUSCATED_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*+-=<>?';

function readFormattingCode(text, index) {
  if (text[index] !== '§' || index + 1 >= text.length) return null;
  const code = text[index + 1].toLowerCase();
  if (code === 'x') {
    const match = text.slice(index + 2).match(/^\{#?([0-9a-f]{6})\}/i);
    if (match) return { code: `x{${match[1].toUpperCase()}}`, length: match[0].length + 2, color: `#${match[1]}` };
  }
  if (MC_COLOR_BY_CODE[code] || code === 'r' || MC_FORMATS[code]) return { code, length: 2 };
  return null;
}

function escapeHtml(text) {
  return text.replace(/[&<>\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
}

function randomObfuscatedText(text) {
  return [...text].map((character) => {
    if (/\s/.test(character)) return character;
    return OBFUSCATED_CHARACTERS[Math.floor(Math.random() * OBFUSCATED_CHARACTERS.length)];
  }).join('');
}

function refreshObfuscatedText(root = document) {
  root.querySelectorAll('.obfuscated').forEach((element) => {
    const bounds = element.getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
    if (!element.dataset.originalText) element.dataset.originalText = element.textContent;
    element.textContent = randomObfuscatedText(element.dataset.originalText);
  });
}

function formattingCodesToHtml(text) {
  const state = { color: null, bold: false, italic: false, underline: false, strikethrough: false, obfuscated: false };
  let html = '';
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    let content = escapeHtml(buffer).replace(/\n/g, '<br>');
    if (state.obfuscated) content = `<span class="obfuscated">${content}</span>`;
    if (state.underline) content = `<u>${content}</u>`;
    if (state.strikethrough) content = `<s>${content}</s>`;
    if (state.italic) content = `<em>${content}</em>`;
    if (state.bold) content = `<strong>${content}</strong>`;
    if (state.color) content = `<span style="color: ${state.color}">${content}</span>`;
    html += content;
    buffer = '';
  };

  for (let index = 0; index < text.length; index += 1) {
    const formattingCode = readFormattingCode(text, index);
    if (formattingCode) {
      const code = formattingCode.code;
      if (code.startsWith('x{')) {
        flush();
        state.color = formattingCode.color;
        state.bold = false;
        state.italic = false;
        state.underline = false;
        state.strikethrough = false;
        state.obfuscated = false;
        index += formattingCode.length - 1;
        continue;
      }
      if (MC_COLOR_BY_CODE[code]) {
        flush();
        state.color = MC_COLOR_BY_CODE[code];
        state.bold = false;
        state.italic = false;
        state.underline = false;
        state.strikethrough = false;
        state.obfuscated = false;
        index += formattingCode.length - 1;
        continue;
      }
      if (code === 'r') {
        flush();
        Object.assign(state, { color: null, bold: false, italic: false, underline: false, strikethrough: false, obfuscated: false });
        index += formattingCode.length - 1;
        continue;
      }
      if (MC_FORMATS[code]) {
        flush();
        state[MC_FORMATS[code]] = true;
        index += formattingCode.length - 1;
        continue;
      }
    }
    buffer += text[index];
  }
  flush();
  return html;
}

function formattingCodesToEditableHtml(text) {
  const state = { color: null, bold: false, italic: false, underline: false, strikethrough: false, obfuscated: false };
  let html = '';
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    let content = escapeHtml(buffer).replace(/\n/g, '<br>');
    if (state.obfuscated) content = `<span class="obfuscated">${content}</span>`;
    if (state.underline) content = `<u>${content}</u>`;
    if (state.strikethrough) content = `<s>${content}</s>`;
    if (state.italic) content = `<em>${content}</em>`;
    if (state.bold) content = `<strong>${content}</strong>`;
    if (state.color) content = `<span style="color: ${state.color}">${content}</span>`;
    html += content;
    buffer = '';
  };

  const addCodeToken = (code) => {
    flush();
    html += `<span class="mc-code" contenteditable="false" data-code="§${code}">§${code}</span>`;
  };

  for (let index = 0; index < text.length; index += 1) {
    const formattingCode = readFormattingCode(text, index);
    if (formattingCode) {
      const code = formattingCode.code;
      if (code.startsWith('x{')) {
        addCodeToken(code);
        state.color = formattingCode.color;
        state.bold = false;
        state.italic = false;
        state.underline = false;
        state.strikethrough = false;
        state.obfuscated = false;
        index += formattingCode.length - 1;
        continue;
      }
      if (MC_COLOR_BY_CODE[code]) {
        addCodeToken(code);
        state.color = MC_COLOR_BY_CODE[code];
        state.bold = false;
        state.italic = false;
        state.underline = false;
        state.strikethrough = false;
        state.obfuscated = false;
        index += formattingCode.length - 1;
        continue;
      }
      if (code === 'r') {
        addCodeToken(code);
        Object.assign(state, { color: null, bold: false, italic: false, underline: false, strikethrough: false, obfuscated: false });
        index += formattingCode.length - 1;
        continue;
      }
      if (MC_FORMATS[code]) {
        addCodeToken(code);
        state[MC_FORMATS[code]] = true;
        index += formattingCode.length - 1;
        continue;
      }
    }
    buffer += text[index];
  }
  flush();
  return html;
}

function applyColorToSelection(editableEl, color) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return false;
  if (!editableEl.contains(range.commonAncestorContainer)) return false;

  const span = document.createElement('span');
  span.style.color = color;
  try {
    range.surroundContents(span);
  } catch (err) {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }

  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  sel.addRange(newRange);
  return true;
}

function sanitizeRichHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;

  const walk = (parent) => {
    const out = [];
    parent.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out.push(document.createTextNode(child.textContent));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'span') {
          const color = child.style && child.style.color;
          const span = document.createElement('span');
          if (color) span.style.color = color;
          if (child.classList.contains('mc-code')) {
            span.className = 'mc-code';
            span.setAttribute('contenteditable', 'false');
            span.dataset.code = child.dataset.code || child.textContent;
          }
          walk(child).forEach((c) => span.appendChild(c));
          out.push(span);
        } else if (tag === 'b' || tag === 'strong') {
          const strong = document.createElement('strong');
          walk(child).forEach((c) => strong.appendChild(c));
          out.push(strong);
        } else if (tag === 'i' || tag === 'em') {
          const em = document.createElement('em');
          walk(child).forEach((c) => em.appendChild(c));
          out.push(em);
        } else if (tag === 'br') {
          out.push(document.createElement('br'));
        } else if (tag === 'div' || tag === 'p') {
          if (out.length > 0) out.push(document.createElement('br'));
          walk(child).forEach((c) => out.push(c));
        } else {
          walk(child).forEach((c) => out.push(c));
        }
      }
    });
    return out;
  };

  const container = document.createElement('div');
  walk(template.content).forEach((n) => container.appendChild(n));

  while (container.firstChild && container.firstChild.nodeName === 'BR') {
    container.removeChild(container.firstChild);
  }

  return container.innerHTML;
}

// se der errado é culpa do GPT, regex é com ele.
function colorToMinecraftCode(color) {
  if (!color) return null;
  const normalized = color.toLowerCase().replace(/\s/g, '');
  if (MC_CODE_BY_COLOR[normalized]) return MC_CODE_BY_COLOR[normalized];
  const match = normalized.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!match) return null;
  const hex = `#${[match[1], match[2], match[3]].map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`;
  if (MC_CODE_BY_COLOR[hex]) return MC_CODE_BY_COLOR[hex];
  return MC_COLORS.reduce((closest, candidate) => {
    const distance = colorDistance(hex, candidate.hex);
    return distance < closest.distance ? { code: candidate.code, distance } : closest;
  }, { code: 'f', distance: Infinity }).code;
}

function colorDistance(first, second) {
  const toRgb = (value) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
  const a = toRgb(first);
  const b = toRgb(second);
  return Math.sqrt(a.reduce((total, value, index) => total + (value - b[index]) ** 2, 0));
}

function htmlToFormattingCodes(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  let output = '';
  let active = null;

  const emitState = (state) => {
    const same = active && ['color', 'bold', 'italic', 'underline', 'strikethrough', 'obfuscated'].every((key) => active[key] === state[key]);
    if (same) return;
    if (active) output += '§r';
    if (state.color) output += `§${state.color}`;
    if (state.bold) output += '§l';
    if (state.italic) output += '§o';
    if (state.underline) output += '§n';
    if (state.strikethrough) output += '§m';
    if (state.obfuscated) output += '§k';
    active = { ...state };
  };

  const walk = (parent, inherited) => {
    parent.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        emitState(inherited);
        output += node.textContent;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.classList.contains('mc-code')) {
        const code = node.textContent.slice(1).toLowerCase();
        const next = { ...inherited };
        if (MC_COLOR_BY_CODE[code]) {
          Object.assign(next, { color: code, bold: false, italic: false, underline: false, strikethrough: false, obfuscated: false });
        } else if (code === 'r') {
          Object.assign(next, { color: null, bold: false, italic: false, underline: false, strikethrough: false, obfuscated: false });
        } else if (MC_FORMATS[code]) {
          next[MC_FORMATS[code]] = true;
        }
        active = { ...next };
        return;
      }
      if (node.tagName.toLowerCase() === 'br') {
        output += '\n';
        return;
      }
      const state = { ...inherited };
      const tag = node.tagName.toLowerCase();
      if (tag === 'strong' || tag === 'b') state.bold = true;
      if (tag === 'em' || tag === 'i') state.italic = true;
      if (tag === 'u') state.underline = true;
      if (tag === 's' || tag === 'strike') state.strikethrough = true;
      if (node.classList.contains('obfuscated')) state.obfuscated = true;
      if (node.style.color) state.color = colorToMinecraftCode(node.style.color);
      walk(node, state);
    });
  };

  walk(template.content, { color: null, bold: false, italic: false, underline: false, strikethrough: false, obfuscated: false });
  return output;
}

function plainTextFromHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

window.RichText = { MC_COLORS, applyColorToSelection, sanitizeRichHtml, formattingCodesToHtml, formattingCodesToEditableHtml, htmlToFormattingCodes, plainTextFromHtml, refreshObfuscatedText };
