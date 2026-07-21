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

function buildRecipeCard(card, { onPlus } = {}) {
  const wrap = el('div', { class: 'recipe-card' });

  if (card.image) {
    wrap.appendChild(el('img', { src: card.image, alt: card.name }));
  }
  wrap.appendChild(el('div', { class: 'recipe-name', html: card.name }));
  if (card.summary) wrap.appendChild(el('div', { class: 'recipe-summary', html: card.summary }));

  const badgeRow = el('div', { class: 'badge-row' });
  if (card.usesNinjaCombi) badgeRow.appendChild(el('span', { class: 'badge', html: '🍲 Ninja Combi' }));
  if (card.usesBlender) badgeRow.appendChild(el('span', { class: 'badge', html: '🥤 Blender' }));
  if (card.usesProteinPowder) badgeRow.appendChild(el('span', { class: 'badge', html: '💪 Protein powder' }));
  (card.tags || []).slice(0, 4).forEach((t) => badgeRow.appendChild(el('span', { class: 'badge tag', html: t })));
  if (badgeRow.children.length) wrap.appendChild(badgeRow);

  const macros = [
    macro('Cal', card.estCaloriesPerServing, ''),
    macro('Protein', card.estProteinG, 'g'),
    macro('Sodium', card.estSodiumMg, 'mg'),
    macro('Carbs', card.estCarbsG, 'g'),
    card.estCostUsd ? `~$${Number(card.estCostUsd).toFixed(2)}` : '',
  ].filter(Boolean);
  if (macros.length) {
    const macroRow = el('div', { class: 'macro-row' });
    macros.forEach((m) => macroRow.appendChild(el('span', {}, [document.createTextNode(m)])));
    wrap.appendChild(macroRow);
  }

  if (card.ingredients && card.ingredients.length) {
    const toggle = el('div', { class: 'instructions-toggle', html: 'Ingredients & steps' });
    const list = el('ul', { class: 'instructions-list' });
    card.ingredients.forEach((i) => list.appendChild(el('li', { html: `🛒 ${i}` })));
    (card.instructions || []).forEach((i) => list.appendChild(el('li', { html: i })));
    toggle.addEventListener('click', () => list.classList.toggle('open'));
    wrap.appendChild(toggle);
    wrap.appendChild(list);
  }

  if (card.source) {
    const src = card.sourceUrl
      ? `Source: <a href="${card.sourceUrl}" target="_blank" rel="noopener">${card.source}</a>`
      : `Source: ${card.source}`;
    wrap.appendChild(el('div', { class: 'recipe-source', html: src }));
  }

  if (onPlus) {
    wrap.appendChild(el('button', { class: 'plus-btn', title: 'Add to plan or recipe book', onclick: () => onPlus(card) }, [document.createTextNode('+')]));
  }

  return wrap;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 2200);
}
