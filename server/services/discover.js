// Builds the "swipe" discovery feed by blending real recipes from
// TheMealDB with recipes Gemini invents specifically to fit this
// household's pantry/equipment/budget/preferences, then normalizes
// everything to one shared shape.
//
// Speed note: earlier versions ran an extra Gemini call to estimate
// nutrition for every single MealDB recipe before returning the feed,
// which meant waiting on ~10 AI calls per page load. Real recipes now come
// back immediately without nutrition numbers; call tagRecipe() below
// on-demand (e.g. when a card is expanded) if you want AI-estimated
// macros for a specific one.

const mealdb = require('./mealdb');
const gemini = require('./gemini');
const photos = require('./photos');

function toCard(recipe) {
  // Normalizes either a MealDB-shaped or Gemini-shaped recipe into the
  // single card shape the frontend expects.
  return {
    id: recipe.externalId ? `mealdb-${recipe.externalId}` : `ai-${Buffer.from(recipe.name).toString('base64').slice(0, 16)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: recipe.name,
    summary: recipe.summary || recipe.healthNote || '',
    ingredients: recipe.ingredients || [],
    instructions: recipe.instructions || [],
    image: recipe.image || null,
    source: recipe.source || 'Gemini',
    sourceUrl: recipe.sourceUrl || null,
    tags: recipe.tags || [],
    usesNinjaCombi: !!recipe.usesNinjaCombi,
    usesBlender: !!recipe.usesBlender,
    usesProteinPowder: !!recipe.usesProteinPowder,
    estCostUsd: recipe.estCostUsd ?? null,
    estCaloriesPerServing: recipe.estCaloriesPerServing ?? null,
    estProteinG: recipe.estProteinG ?? null,
    estSodiumMg: recipe.estSodiumMg ?? null,
    estCarbsG: recipe.estCarbsG ?? null,
  };
}

// Fills in a photo (via Pexels) for any card that doesn't already have one
// -- mainly AI-invented recipes, which never come with a photo of their
// own. If PEXELS_API_KEY isn't configured, or a lookup comes back empty,
// the card is left as-is and the frontend shows a food-emoji tile
// instead. Runs all lookups in parallel so it doesn't add up latency.
async function attachPhotos(cards) {
  await Promise.all(
    cards.map(async (c) => {
      if (c.image) return;
      try {
        const url = await photos.getPhotoUrl(c.name);
        if (url) c.image = url;
      } catch (e) {
        // ignore -- frontend falls back to an emoji tile
      }
    })
  );
  return cards;
}

async function buildSwipeFeed({ likedTags = [], dislikedTags = [], pantryItems = [], count = 8 }) {
  const half = Math.ceil(count / 2);

  const [randomMeals, aiRecipes] = await Promise.all([
    mealdb.getRandomMeals(half).catch(() => []),
    gemini
      .generateRecipes({ count: count - half, pantryItems, likedTags, dislikedTags, mode: 'dinner' })
      .catch(() => []),
  ]);

  const cards = [...randomMeals.map(toCard), ...aiRecipes.map(toCard)];
  // Simple shuffle so real/AI recipes are interleaved rather than in two
  // visible blocks.
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  await attachPhotos(cards);
  return cards;
}

async function searchRecipes({ query, pantryItems = [], likedTags = [], dislikedTags = [] }) {
  const [byName, byIngredient, aiRecipes] = await Promise.all([
    mealdb.searchByName(query).catch(() => []),
    mealdb.searchByIngredient(query).catch(() => []),
    gemini
      .generateRecipes({ count: 4, request: query, pantryItems, likedTags, dislikedTags, mode: 'dinner' })
      .catch(() => []),
  ]);
  const seen = new Set();
  const externalMeals = [...byName, ...byIngredient].filter((m) => {
    if (seen.has(m.externalId)) return false;
    seen.add(m.externalId);
    return true;
  });
  const cards = [...aiRecipes.map(toCard), ...externalMeals.slice(0, 8).map(toCard)];
  await attachPhotos(cards);
  return cards;
}

// Real (not AI-invented) Ninja Combi / Ninja Foodi recipes, found via
// Google Search grounding and then structured into cards. This is
// slower and costs an extra couple of AI calls, so it's kept as an
// explicit, on-demand action (see GET /api/discover/ninja-combi) rather
// than being folded into every feed/search load.
async function findRealNinjaComboRecipes({ request = '' } = {}) {
  const recipes = await gemini.findRealNinjaComboRecipes({ request });
  const cards = recipes.map(toCard);
  await attachPhotos(cards);
  return cards;
}

// On-demand nutrition estimate for a single recipe (used when the
// frontend wants macros for a real recipe that came back untagged).
async function tagRecipe({ name, ingredients, instructions }) {
  const tags = await gemini.tagExternalRecipe({ name, ingredients, instructions });
  return tags;
}

module.exports = { buildSwipeFeed, searchRecipes, toCard, tagRecipe, attachPhotos, findRealNinjaComboRecipes };
