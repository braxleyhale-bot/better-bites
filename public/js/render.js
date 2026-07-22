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

function buildBadgeRow(card) {
  const badgeRow = el('div', { class: 'badge-row' });
  if (card.usesNinjaCombi) badgeRow.appendChild(el('span', { class: 'badge', html: '🍲 Ninja Combi' }));
  if (card.usesBlender) badgeRow.appendChild(el('span', { class: 'badge', html: '🥤 Blender' }));
  if (card.usesProteinPowder) badgeRow.appendChild(el('span', { class: 'badge', html: '💪 Protein' }));
  (card.tags || []).slice(0, 3).forEach((t) => badgeRow.appendChild(el('span', { class: 'badge tag', html: t })));
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

function buildIngredientsToggle(card) {
  const frag = document.createDocumentFragment();
  if (!card.ingredients || !card.ingredients.length) return frag;
  const toggle = el('div', { class: 'instructions-toggle', html: 'Ingredients & steps' });
  const list = el('ul', { class: 'instructions-list' });
  card.ingredients.forEach((i) => list.appendChild(el('li', { html: `🛒 ${i}` })));
  (card.instructions || []).forEach((i) => list.appendChild(el('li', { html: i })));
  toggle.addEventListener('click', () => list.classList.toggle('open'));
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

// variant: 'grid' (default, used in Search/Snacks results) or 'hero'
// (full-bleed image card used in the Discover swipe stage)
function buildRecipeCard(card, { onPlus, variant = 'grid' } = {}) {
  if (variant === 'hero') return buildHeroCard(card, { onPlus });

  const wrap = el('div', { class: 'recipe-card' });

  if (card.image) {
    wrap.appendChild(el('div', { class: 'card-img-wrap' }, [el('img', { src: card.image, alt: card.name })]));
  }

  const body = el('div', { class: 'card-body' });
  body.appendChild(el('div', { class: 'recipe-name', html: card.name }));
  if (card.summary) body.appendChild(el('div', { class: 'recipe-summary', html: card.summary }));

  const badgeRow = buildBadgeRow(card);
  if (badgeRow.children.length) body.appendChild(badgeRow);

  const { macroRow, hasMacros } = buildMacroRow(card);
  if (hasMacros) body.appendChild(macroRow);

  body.appendChild(buildIngredientsToggle(card));

  const sourceLine = buildSourceLine(card);
  if (sourceLine) body.appendChild(sourceLine);

  wrap.appendChild(body);

  if (onPlus) {
    wrap.appendChild(el('button', { class: 'plus-btn', title: 'Add to plan or recipe book', onclick: () => onPlus(card) }, [document.createTextNode('+')]));
  }

  return wrap;
}

function buildHeroCard(card, { onPlus } = {}) {
  const wrap = el('div', { class: 'hero-card' });

  const imgWrap = el('div', { class: 'hero-img-wrap' });
  if (card.image) {
    imgWrap.appendChild(el('img', { src: card.image, alt: card.name }));
  }
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
  details.appendChild(buildIngredientsToggle(card));
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
