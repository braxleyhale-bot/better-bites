// Main app logic: tab switching, search, swipe deck, calendar, snacks, pantry.

// ---------- Tab switching (bottom nav) ----------
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'calendar') loadCalendar();
    if (btn.dataset.tab === 'cookbook') loadCookbookRecipes();
  });
});

// ---------- Modal (add to plan / save to recipe book) ----------
const modalOverlay = document.getElementById('modalOverlay');
const modalDays = document.getElementById('modalDays');
let modalCard = null;
let modalSelectedDate = null;
let modalSkipSave = false;

function weekDates(startDate) {
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function openModal(card, { skipSave = false } = {}) {
  modalCard = card;
  modalSelectedDate = null;
  modalSkipSave = skipSave;
  modalDays.innerHTML = '';
  const today = new Date();
  weekDates(today).forEach((d) => {
    const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      modalDays.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      modalSelectedDate = d.toISOString().slice(0, 10);
    });
    modalDays.appendChild(btn);
  });
  document.getElementById('modalSaveOnly').style.display = skipSave ? 'none' : 'block';
  document.getElementById('modalSub').textContent = skipSave
    ? 'Add this saved recipe to a day this week.'
    : "Add to a day this week, or just save it to your recipe book.";
  modalOverlay.classList.add('open');
}

document.getElementById('modalClose').addEventListener('click', () => modalOverlay.classList.remove('open'));

async function saveToRecipeBook(card) {
  await api.post('/api/recipes', card);
}

document.getElementById('modalSaveOnly').addEventListener('click', async () => {
  try {
    await saveToRecipeBook(modalCard);
    showToast(`Saved "${modalCard.name}" to your recipe book`);
    modalOverlay.classList.remove('open');
  } catch (e) {
    showToast(`Couldn't save: ${e.message}`);
  }
});

// Clicking a day selects it (see openModal above); this button then both
// saves the recipe to the recipe book and plans it for the selected day.
function ensureAddToDayButton() {
  let btn = document.getElementById('modalAddToDay');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'modalAddToDay';
    btn.className = 'btn primary full';
    btn.textContent = 'Add to selected day';
    btn.addEventListener('click', async () => {
      if (!modalSelectedDate) {
        showToast('Pick a day first');
        return;
      }
      try {
        if (!modalSkipSave) await saveToRecipeBook(modalCard);
        await api.post('/api/mealplan', {
          Date: modalSelectedDate,
          MealSlot: 'Dinner',
          RecipeName: modalCard.name,
        });
        showToast(`Added "${modalCard.name}" to your plan`);
        modalOverlay.classList.remove('open');
      } catch (e) {
        showToast(`Couldn't add: ${e.message}`);
      }
    });
    document.getElementById('modalSaveOnly').insertAdjacentElement('beforebegin', btn);
  }
}
const modalObserver = new MutationObserver(() => {
  if (modalOverlay.classList.contains('open')) ensureAddToDayButton();
});
modalObserver.observe(modalOverlay, { attributes: true, attributeFilter: ['class'] });

// ---------- Home: today's suggestion ----------
document.getElementById('loadSuggestion').addEventListener('click', loadSuggestion);
document.getElementById('refreshSuggestion').addEventListener('click', loadSuggestion);

async function loadSuggestion() {
  const box = document.getElementById('suggestionContent');
  box.innerHTML = 'Thinking about what you\'ve eaten lately...';
  try {
    const data = await api.get('/api/suggestion/today');
    box.innerHTML = '';
    const rec = document.createElement('div');
    rec.innerHTML = `<strong>${data.recommendation}</strong><br><span style="color:var(--muted)">${data.reasoning}</span>`;
    box.appendChild(rec);
    if (data.recipe) {
      box.appendChild(buildRecipeCard(data.recipe, { onPlus: openModal }));
    }
  } catch (e) {
    box.innerHTML = `Couldn't get a suggestion: ${e.message}`;
  }
}

// ---------- Home: search ----------
document.getElementById('searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  const results = document.getElementById('searchResults');
  results.innerHTML = 'Searching...';
  try {
    const data = await api.get(`/api/discover/search?q=${encodeURIComponent(q)}`);
    results.innerHTML = '';
    if (!data.cards.length) {
      results.innerHTML = 'No recipes found — try a different search.';
      return;
    }
    data.cards.forEach((card) => results.appendChild(buildRecipeCard(card, { onPlus: openModal })));
  } catch (e) {
    results.innerHTML = `Search failed: ${e.message}`;
  }
});

// ---------- Home: discover / swipe ----------
let swipeDeck = [];
const swipeStage = document.getElementById('swipeStage');
const swipeControls = document.getElementById('swipeControls');

document.getElementById('loadFeed').addEventListener('click', loadFeed);

async function loadFeed() {
  swipeStage.innerHTML = '<div class="swipe-empty">Loading recipes...</div>';
  try {
    const data = await api.get('/api/discover/feed?count=8');
    swipeDeck = data.cards;
    renderSwipeDeck();
  } catch (e) {
    swipeStage.innerHTML = `<div class="swipe-empty">Couldn't load recipes: ${e.message}</div>`;
  }
}

function renderSwipeDeck() {
  swipeStage.innerHTML = '';
  if (!swipeDeck.length) {
    swipeStage.innerHTML = '<div class="swipe-empty"><p>You\'re out of recipes for now.</p><button id="loadFeed2" class="btn primary">Load more</button></div>';
    document.getElementById('loadFeed2').addEventListener('click', loadFeed);
    swipeControls.style.display = 'none';
    return;
  }
  swipeControls.style.display = 'flex';
  const card = swipeDeck[0];
  const cardEl = buildRecipeCard(card, { variant: 'hero' });
  swipeStage.appendChild(cardEl);
}

async function recordSwipe(card, liked) {
  try {
    await api.post('/api/discover/swipe', { name: card.name, tags: card.tags, liked, source: card.source });
  } catch (e) {
    // non-fatal
  }
}

document.getElementById('swipeNo').addEventListener('click', async () => {
  if (!swipeDeck.length) return;
  const card = swipeDeck.shift();
  await recordSwipe(card, false);
  renderSwipeDeck();
});

document.getElementById('swipeYes').addEventListener('click', async () => {
  if (!swipeDeck.length) return;
  const card = swipeDeck.shift();
  await recordSwipe(card, true);
  await saveToRecipeBook(card).catch(() => {});
  showToast(`Liked "${card.name}" — saved to your recipe book`);
  renderSwipeDeck();
});

document.getElementById('swipePlus').addEventListener('click', () => {
  if (!swipeDeck.length) return;
  openModal(swipeDeck[0]);
});

// ---------- Calendar ----------
let weekStart = startOfWeek(new Date());

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

document.getElementById('prevWeek').addEventListener('click', () => {
  weekStart.setDate(weekStart.getDate() - 7);
  loadCalendar();
});
document.getElementById('nextWeek').addEventListener('click', () => {
  weekStart.setDate(weekStart.getDate() + 7);
  loadCalendar();
});

async function loadCalendar() {
  const days = weekDates(weekStart);
  const label = document.getElementById('weekLabel');
  label.textContent = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  const grid = document.getElementById('weekGrid');
  grid.innerHTML = 'Loading...';
  let plan = [];
  try {
    const data = await api.get('/api/mealplan');
    plan = data.plan;
  } catch (e) {
    grid.innerHTML = `Couldn't load calendar: ${e.message}`;
    return;
  }

  grid.innerHTML = '';
  days.forEach((d) => {
    const iso = d.toISOString().slice(0, 10);
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.appendChild(el('div', { class: 'day-name', html: d.toLocaleDateString(undefined, { weekday: 'long' }) }));
    cell.appendChild(el('div', { class: 'day-date', html: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }));

    const meals = plan.filter((p) => p.Date === iso);
    meals.forEach((m) => {
      const row = el('div', { class: 'day-meal' });
      row.appendChild(document.createTextNode(m.RecipeName));
      const del = document.createElement('button');
      del.textContent = '✕';
      del.addEventListener('click', async () => {
        await api.del(`/api/mealplan/${m._rowIndex}`);
        loadCalendar();
      });
      row.appendChild(del);
      cell.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'day-add-btn';
    addBtn.textContent = '+ add dinner';
    addBtn.addEventListener('click', async () => {
      const name = prompt('Recipe name to add to this day:');
      if (!name) return;
      await api.post('/api/mealplan', { Date: iso, MealSlot: 'Dinner', RecipeName: name });
      loadCalendar();
    });
    cell.appendChild(addBtn);

    grid.appendChild(cell);
  });
}

// ---------- Snacks ----------
document.getElementById('snackForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const request = document.getElementById('snackInput').value.trim();
  const results = document.getElementById('snackResults');
  results.innerHTML = 'Thinking of snacks...';
  try {
    const data = await api.get(`/api/snacks?request=${encodeURIComponent(request)}`);
    results.innerHTML = '';
    data.cards.forEach((card) => results.appendChild(buildRecipeCard(card, { onPlus: openModal })));
  } catch (e) {
    results.innerHTML = `Couldn't get snack ideas: ${e.message}`;
  }
});

// ---------- Cookbook (saved recipes + pantry, in one tab) ----------
document.querySelectorAll('.segmented-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.segmented-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.cookbook-view').forEach((v) => v.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.view === 'recipes') {
      document.getElementById('cookbookRecipesView').classList.add('active');
    } else {
      document.getElementById('cookbookPantryView').classList.add('active');
      loadPantry();
    }
  });
});

// Saved RecipeBook rows come back from the Sheet as flat strings (pipe/
// comma separated), so adapt them to the same card shape everything else
// on the page renders.
function recipeRecordToCard(r) {
  return {
    _rowIndex: r._rowIndex,
    id: r.ID,
    name: r.Name,
    summary: '',
    ingredients: String(r.Ingredients || '').split('|').map((s) => s.trim()).filter(Boolean),
    instructions: String(r.Instructions || '').split('|').map((s) => s.trim()).filter(Boolean),
    tags: String(r.Tags || '').split(',').map((s) => s.trim()).filter(Boolean),
    source: r.Source || 'Saved',
    sourceUrl: null,
    image: null,
    usesNinjaCombi: String(r.UsesNinjaCombi).toLowerCase() === 'yes',
    usesBlender: String(r.UsesBlender).toLowerCase() === 'yes',
    usesProteinPowder: false,
    estCostUsd: r.EstCostUSD ? Number(r.EstCostUSD) : null,
    estCaloriesPerServing: r.Calories ? Number(r.Calories) : null,
    estProteinG: r.ProteinG ? Number(r.ProteinG) : null,
    estSodiumMg: r.SodiumMg ? Number(r.SodiumMg) : null,
    estCarbsG: r.CarbsG ? Number(r.CarbsG) : null,
  };
}

async function loadCookbookRecipes() {
  const grid = document.getElementById('cookbookRecipes');
  grid.innerHTML = 'Loading your recipe book...';
  try {
    const data = await api.get('/api/recipes');
    const records = data.recipes.filter((r) => r.Name);
    grid.innerHTML = '';
    if (!records.length) {
      grid.innerHTML = '<p style="color:var(--muted)">No saved recipes yet — tap + on any recipe in Search, Discover, or Snacks to add it here.</p>';
      return;
    }
    records.forEach((r) => {
      const card = recipeRecordToCard(r);
      grid.appendChild(buildRecipeCard(card, {
        onPlus: (c) => openModal(c, { skipSave: true }),
        onRemove: async (c) => {
          try {
            await api.del(`/api/recipes/${c._rowIndex}`);
            showToast(`Removed "${c.name}"`);
            loadCookbookRecipes();
          } catch (e) {
            showToast(`Couldn't remove: ${e.message}`);
          }
        },
      }));
    });
  } catch (e) {
    grid.innerHTML = `Couldn't load your recipe book: ${e.message}`;
  }
}

// ---------- Pantry ----------
document.getElementById('pantryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const item = document.getElementById('pantryItem').value.trim();
  if (!item) return;
  try {
    await api.post('/api/pantry', {
      Item: item,
      Quantity: document.getElementById('pantryQty').value,
      Unit: document.getElementById('pantryUnit').value,
      Category: document.getElementById('pantryCategory').value,
      Location: document.getElementById('pantryLocation').value,
    });
    document.getElementById('pantryForm').reset();
    loadPantry();
  } catch (e) {
    showToast(`Couldn't add item: ${e.message}`);
  }
});

async function loadPantry() {
  const list = document.getElementById('pantryList');
  list.innerHTML = 'Loading...';
  try {
    const data = await api.get('/api/pantry');
    list.innerHTML = '';
    if (!data.items.length) {
      list.innerHTML = '<p style="color:var(--muted)">No pantry items yet — add what you\'ve got above.</p>';
      return;
    }
    data.items.forEach((item) => {
      if (!item.Item) return;
      const row = document.createElement('div');
      row.className = 'pantry-row';
      row.innerHTML = `<div><strong>${item.Item}</strong> <span class="meta">${[item.Quantity, item.Unit, item.Category, item.Location].filter(Boolean).join(' · ')}</span></div>`;
      const del = document.createElement('button');
      del.textContent = 'Remove';
      del.addEventListener('click', async () => {
        await api.del(`/api/pantry/${item._rowIndex}`);
        loadPantry();
      });
      row.appendChild(del);
      list.appendChild(row);
    });
  } catch (e) {
    list.innerHTML = `Couldn't load pantry: ${e.message}`;
  }
}
