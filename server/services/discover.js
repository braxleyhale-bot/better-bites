// Builds the "swipe" discovery feed by blending real recipes from
// TheMealDB with recipes Gemini invents specifically to fit this
// household's pantry/equipment/budget/preferences, then normalizes
// everything to one shared shape and adds AI nutrition tags to the
// MealDB recipes (which don't come with any).

const mealdb = require('./mealdb');
const gemini = require('./gemini');

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

async function buildSwipeFeed({ likedTags = [], dislikedTags = [], pantryItems = [], count = 10 }) {
  const half = Math.ceil(count / 2);

  const [randomMeals, aiRecipes] = await Promise.all([
    mealdb.getRandomMeals(half).catch(() => []),
    gemini
      .generateRecipes({ count: count - half, pantryItems, likedTags, dislikedTags, mode: 'dinner' })
      .catch(() => []),
  ]);

  // Tag the real recipes with AI-estimated nutrition (best effort; if this
  // fails for one, it's still shown, just without nutrition numbers).
  const taggedMeals = await Promise.all(
    randomMeals.map(async (m) => {
      try {
        const tags = await gemini.tagExternalRecipe({
          name: m.name,
          ingredients: m.ingredients,
          instructions: m.instructions.join(' '),
        });
        return { ...m, ...tags, tags: [...m.tags] };
      } catch (e) {
        return m;
      }
    })
  );

  const cards = [...taggedMeals.map(toCard), ...aiRecipes.map(toCard)];
  // Simple shuffle so real/AI recipes are interleaved rather than in two
  // visible blocks.
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
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
  const taggedMeals = await Promise.all(
    externalMeals.slice(0, 8).map(async (m) => {
      try {
        const tags = await gemini.tagExternalRecipe({
          name: m.name,
          ingredients: m.ingredients,
          instructions: m.instructions.join(' '),
        });
        return { ...m, ...tags };
      } catch (e) {
        return m;
      }
    })
  );
  return [...aiRecipes.map(toCard), ...taggedMeals.map(toCard)];
}

module.exports = { buildSwipeFeed, searchRecipes, toCard };
