// Rendering helpers shared across tabs. Builds a recipe "card" DOM node
// from the normalized card shape produced by the backend (server/services/discover.js toCard()).

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(opts).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.forEach((c) => node.appendChild(c));
  return node;
}

function macro(label, value, unit) {
  if (value === null || value === undefined || value === '') return '';
  return `${label} ${Math.round(value)}${unit}`;
}

// Equipment badges (Ninja Combi / Blender / Protein) are rendered from
// their own boolean flags. Recipes sometimes also carry the same words as
// plain tags (e.g. AI recipes tagging themselves "Ninja Combi"), which
// used to show up as a second, duplicate pill. This filters those out.
const EQUIPMENT_WORDS = ['ninja combi', 'blender', 'protein', 'protein powder'];
function dedupeTags(card) {
  return (card.tags || []).filter((t) => !EQUIPMENT_WORDS.includes(String(t).trim().toLowerCase()));
}

function buildBadgeRow(card) {
  const badgeRow = el('div', { class: 'badge-row' });
  if (card.usesNinjaCombi) badgeRow.appendChild(el('span', { class: 'badge', html: '🍲 Ninja Combi' }));
  if (card.usesBlender) badgeRow.appendChild(el('span', { class: 'badge', html: '🥤 Blender' }));
  if (card.usesProteinPowder) badgeRow.appendChild(el('span', { class: 'badge', html: '💪 Protein' }));
  dedupeTags(card).slice(0, 3).forEach((t) => badgeRow.appendChild(el('span', { class: 'badge tag', html: t })));
  return badgeRow;
}

function buildMacroRow(card) {
  const macros = [
    macro('Cal', card.estCaloriesPerServing, ''),
    macro('Protein', card.estProteinG, 'g'),
    macro('Sodium', card.estSodiumMg, 'mg'),
    macro('Carbs', card.estCarbsG, 'g'),
    card.estCostUsd ? `~$${Number(card.estCostUsd).toFixed(2)}` : '',
  ].filter(Boolean);
  const macroRow = el('div', { class: 'macro-row' });
  macros.forEach((m) => macroRow.appendChild(el('span', {}, [document.createTextNode(m)])));
  return { macroRow, hasMacros: macros.length > 0 };
}

// Lazily fetches an AI nutrition estimate for a real (non-Gemini) recipe
// that doesn't have macros yet, and swaps in a macro row once it arrives.
// Keeps the initial page load fast — nothing calls this until someone
// actually opens a card's ingredients.
function attachLazyNutrition(card, container) {
  if (card.estCaloriesPerServing || card.source === 'Gemini' || !card.ingredients.length) return;
  let requested = false;
  return async () => {
    if (requested) return;
    requested = true;
    const note = el('div', { class: 'macro-row', html: 'Estimating nutrition…' });
    container.appendChild(note);
    try {
      const tags = await api.post('/api/discover/tag', {
        name: card.name,
        ingredients: card.ingredients,
        instructions: card.instructions,
      });
      Object.assign(card, tags);
      const { macroRow, hasMacros } = buildMacroRow(card);
      if (hasMacros) note.replaceWith(macroRow);
      else note.remove();
    } catch (e) {
      note.remove();
    }
  };
}

function buildIngredientsToggle(card, { onOpen } = {}) {
  const frag = document.createDocumentFragment();
  if (!card.ingredients || !card.ingredients.length) return frag;
  const toggle = el('div', { class: 'instructions-toggle', html: 'Ingredients & steps' });
  const list = el('ul', { class: 'instructions-list' });
  card.ingredients.forEach((i) => list.appendChild(el('li', { html: `🛒 ${i}` })));
  (card.instructions || []).forEach((i) => list.appendChild(el('li', { html: i })));
  let opened = false;
  toggle.addEventListener('click', () => {
    list.classList.toggle('open');
    if (!opened && list.classList.contains('open')) {
      opened = true;
      if (onOpen) onOpen();
    }
  });
  frag.appendChild(toggle);
  frag.appendChild(list);
  return frag;
}

function buildSourceLine(card) {
  if (!card.source) return null;
  const src = card.sourceUrl
    ? `Source: <a href="${card.sourceUrl}" target="_blank" rel="noopener">${card.source}</a>`
    : `Source: ${card.source}`;
  return el('div', { class: 'recipe-source', html: src });
}

// A small set of food emoji used as a lightweight, zero-network fallback
// whenever a recipe has no photo (mainly AI-generated recipes). Picked by
// keyword match against the name/tags/summary, falling back to a stable
// hash so the same recipe always gets the same icon.
const EMOJI_RULES = [
  [['ice cream', 'nice cream', 'frozen', 'sorbet'], '🍨'],
  [['dessert', 'sweet', 'cookie', 'cake', 'brownie'], '🍪'],
  [['breakfast', 'egg', 'pancake', 'oat', 'waffle'], '🍳'],
  [['smoothie', 'shake', 'drink'], '🥤'],
  [['chicken'], '🍗'],
  [['beef', 'steak'], '🥩'],
  [['fish', 'salmon', 'seafood', 'shrimp'], '🐟'],
  [['pasta', 'spaghetti', 'noodle'], '🍝'],
  [['salad'], '🥗'],
  [['soup', 'stew', 'chili'], '🍲'],
  [['taco', 'mexican', 'burrito', 'quesadilla'], '🌮'],
  [['pizza'], '🍕'],
  [['sandwich', 'toast', 'grilled cheese'], '🥪'],
  [['rice', 'asian', 'stir fry', 'stir-fry'], '🍚'],
];
const EMOJI_FALLBACK = ['🍽️', '🥘', '🍛', '🧆', '🥙'];
function pickEmoji(card) {
  const hay = `${card.name || ''} ${(card.tags || []).join(' ')} ${card.summary || ''}`.toLowerCase();
  for (const [keys, emoji] of EMOJI_RULES) {
    if (keys.some((k) => hay.includes(k))) return emoji;
  }
  let hash = 0;
  for (const ch of card.name || '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return EMOJI_FALLBACK[hash % EMOJI_FALLBACK.length];
}

// Builds the image element for a card, falling back to an emoji tile if
// there's no image URL, or if the image URL fails to actually load
// (some hotlinked thumbnails are unreliable).
function buildMedia(card) {
  const container = el('div', {});
  function showPlaceholder() {
    container.innerHTML = '';
    container.appendChild(el('div', { class: 'img-placeholder' }, [document.createTextNode(pickEmoji(card))]));
  }
  if (card.image) {
    container.appendChild(el('img', { src: card.image, alt: card.name, loading: 'lazy', onerror: showPlaceholder }));
  } else {
    showPlaceholder();
  }
  return container;
}

// variant: 'grid' (default, used in Search/Snacks/Cookbook results) or
// 'hero' (full-bleed image card used in the Discover swipe stage)
function buildRecipeCard(card, { onPlus, onRemove, variant = 'grid' } = {}) {
  if (variant === 'hero') return buildHeroCard(card, { onPlus });

  const wrap = el('div', { class: 'recipe-card' });

  const imgWrap = el('div', { class: 'card-img-wrap' }, [buildMedia(card)]);
  wrap.appendChild(imgWrap);

  const body = el('div', { class: 'card-body' });
  body.appendChild(el('div', { class: 'recipe-name', html: card.name }));
  if (card.summary) body.appendChild(el('div', { class: 'recipe-summary', html: card.summary }));

  const badgeRow = buildBadgeRow(card);
  if (badgeRow.children.length) body.appendChild(badgeRow);

  const { macroRow, hasMacros } = buildMacroRow(card);
  if (hasMacros) body.appendChild(macroRow);

  const loadNutrition = attachLazyNutrition(card, body);
  body.appendChild(buildIngredientsToggle(card, { onOpen: loadNutrition }));

  const sourceLine = buildSourceLine(card);
  if (sourceLine) body.appendChild(sourceLine);

  wrap.appendChild(body);

  if (onPlus) {
    wrap.appendChild(el('button', { class: 'plus-btn', title: 'Add to plan or recipe book', onclick: () => onPlus(card) }, [document.createTextNode('+')]));
  }
  if (onRemove) {
    wrap.appendChild(el('button', { class: 'remove-btn', title: 'Remove from recipe book', onclick: () => onRemove(card) }, [document.createTextNode('×')]));
  }

  return wrap;
}

function buildHeroCard(card, { onPlus } = {}) {
  const wrap = el('div', { class: 'hero-card' });

  const imgWrap = el('div', { class: 'hero-img-wrap' }, [buildMedia(card)]);
  imgWrap.appendChild(el('div', { class: 'hero-scrim' }));
  imgWrap.appendChild(el('div', { class: 'hero-title-overlay' }, [el('div', { class: 'recipe-name', html: card.name })]));
  if (card.source) imgWrap.appendChild(el('div', { class: 'hero-source', html: card.source }));

  const badgeRow = buildBadgeRow(card);
  if (badgeRow.children.length) {
    badgeRow.classList.add('hero-badges');
    imgWrap.appendChild(badgeRow);
  }
  wrap.appendChild(imgWrap);

  const details = el('div', { class: 'hero-details' });
  if (card.summary) details.appendChild(el('div', { class: 'recipe-summary', html: card.summary }));
  const { macroRow, hasMacros } = buildMacroRow(card);
  if (hasMacros) details.appendChild(macroRow);
  const loadNutrition = attachLazyNutrition(card, details);
  const ingToggle = buildIngredientsToggle(card, { onOpen: loadNutrition });
  details.appendChild(ingToggle);
  if (!card.summary && !hasMacros && (!card.ingredients || !card.ingredients.length)) {
    details.appendChild(el('div', { class: 'recipe-summary', html: 'No extra details for this one — swipe to see the next.' }));
  }
  wrap.appendChild(details);

  return wrap;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 2200);
}
