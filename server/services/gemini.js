// Wrapper around the Gemini API for everything AI-related in the app:
// - suggesting what to eat tonight based on recent meals (so you don't
//   repeat tacos five days running)
// - inventing brand-new recipes that fit the pantry, the Ninja Combi / the
//   blender, the protein powder, and the budget
// - scoring/health-tagging recipes pulled in from TheMealDB (which has no
//   nutrition data of its own)
// - dreaming up healthy-ish snack and homemade "ice cream" ideas that use
//   the Ninja blender + blender bottles instead of a Creami

const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

let genAI = null;
function client() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set. See SETUP.md.');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

const HOUSEHOLD_CONTEXT = `
You are helping a household of two (Braxley and Eira) eat healthier without
making food miserable. Hard context you must always respect:
- Budget: total food spending should stay under $500/month for both people
  combined. Prefer cheap, everyday ingredients over specialty items.
- Equipment: they cook most dinners in a Ninja Combi (a multi-cooker/air
  fryer/pressure cooker combo appliance) and usually eat leftovers from that
  dinner across the week. They also have a Ninja blender with blender
  bottles (NOT a Ninja Creami) for smoothies/shakes/soft-serve-style treats.
- Protein: they have a high-quality vanilla protein powder (Nutritek) and
  want it worked into meals and snacks whenever it makes sense, but it must
  be completely undetectable in taste/texture in the final dish. Only use it
  in things where that's realistic (blended drinks, baked goods, oatmeal,
  sauces) -- never force it into a dish where it would be noticeable.
- Eira likes ice cream a lot. The goal is NOT to eliminate treats like ice
  cream, but to offer lower-processed-carb, lower-calorie, lower-sodium
  homemade or smart store-bought alternatives that still feel indulgent.
- Every full meal/recipe suggestion should include a real source of protein.
- Avoid recommending the same meal or cuisine too many times in the same
  week -- variety matters as much as "healthy."
- Tone: practical and realistic, never preachy or restrictive. This is
  about balance, not a diet.
`.trim();

async function generateJSON({ prompt, schema }) {
  const model = client().getGenerativeModel({
    model: 'gemini-3.5-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });
  const result = await model.generateContent(
    `${HOUSEHOLD_CONTEXT}\n\n${prompt}`
  );
  const text = result.response.text();
  return JSON.parse(text);
}

// --- Schemas -----------------------------------------------------------

const recipeSchema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    ingredients: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    instructions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    usesNinjaCombi: { type: SchemaType.BOOLEAN },
    usesBlender: { type: SchemaType.BOOLEAN },
    usesProteinPowder: { type: SchemaType.BOOLEAN },
    estCostUsd: { type: SchemaType.NUMBER },
    estCaloriesPerServing: { type: SchemaType.NUMBER },
    estProteinG: { type: SchemaType.NUMBER },
    estSodiumMg: { type: SchemaType.NUMBER },
    estCarbsG: { type: SchemaType.NUMBER },
    tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    healthNote: { type: SchemaType.STRING },
  },
  required: [
    'name', 'summary', 'ingredients', 'instructions', 'usesNinjaCombi',
    'usesBlender', 'usesProteinPowder', 'estCostUsd', 'estCaloriesPerServing',
    'estProteinG', 'estSodiumMg', 'estCarbsG', 'tags', 'healthNote',
  ],
};

const recipeListSchema = {
  type: SchemaType.OBJECT,
  properties: { recipes: { type: SchemaType.ARRAY, items: recipeSchema } },
  required: ['recipes'],
};

const suggestionSchema = {
  type: SchemaType.OBJECT,
  properties: {
    recommendation: { type: SchemaType.STRING },
    reasoning: { type: SchemaType.STRING },
    healthDirection: { type: SchemaType.STRING }, // "lighter" | "normal" | "can splurge a bit"
    recipe: recipeSchema,
  },
  required: ['recommendation', 'reasoning', 'healthDirection', 'recipe'],
};

const nutritionTagSchema = {
  type: SchemaType.OBJECT,
  properties: {
    estCaloriesPerServing: { type: SchemaType.NUMBER },
    estProteinG: { type: SchemaType.NUMBER },
    estSodiumMg: { type: SchemaType.NUMBER },
    estCarbsG: { type: SchemaType.NUMBER },
    estCostUsd: { type: SchemaType.NUMBER },
    healthTags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    proteinPowderIdea: { type: SchemaType.STRING },
  },
  required: [
    'estCaloriesPerServing', 'estProteinG', 'estSodiumMg', 'estCarbsG',
    'estCostUsd', 'healthTags', 'proteinPowderIdea',
  ],
};

// --- Public functions ----------------------------------------------------

// "What should we eat tonight" — looks at recent meals (last ~7 days) plus
// what's in the pantry, and suggests one dinner, nudging toward lighter
// options if recent meals have trended heavy/processed/repetitive.
async function suggestDailyMeal({ recentMeals = [], pantryItems = [], likedTags = [], dislikedTags = [] }) {
  const prompt = `
Recent meals eaten in the last 7 days (most recent first):
${recentMeals.length ? recentMeals.map((m) => `- ${m}`).join('\n') : '(no data yet)'}

Pantry items currently on hand:
${pantryItems.length ? pantryItems.map((p) => `- ${p}`).join('\n') : '(no pantry data yet, assume a normal grocery basics stock)'}

Tags they've liked from past swiping: ${likedTags.join(', ') || 'none yet'}
Tags they've disliked: ${dislikedTags.join(', ') || 'none yet'}

Suggest ONE dinner for tonight for two people, designed for the Ninja Combi
where reasonable, with leftovers in mind for the rest of the week. Look at
the recent meals list: if it's been heavy/fried/processed/repetitive lately,
suggest something lighter; if it's been very light, it's fine to suggest
something a bit more indulgent. Do not repeat a cuisine/protein/dish they've
had 2+ times in the last 7 days (e.g. no tacos again if they've had tacos
twice this week already).
`.trim();
  return generateJSON({ prompt, schema: suggestionSchema });
}

// Invent brand-new full recipes (used both for on-demand "generate me a
// recipe" requests and to seed part of the swipe-discovery feed).
async function generateRecipes({ count = 5, request = '', pantryItems = [], likedTags = [], dislikedTags = [], mode = 'dinner' }) {
  const prompt = `
Generate ${count} distinct ${mode} recipe ideas for two people.
${request ? `Specific request from the user: "${request}"` : ''}

Pantry items on hand (prefer using these where sensible, but don't force it):
${pantryItems.length ? pantryItems.map((p) => `- ${p}`).join('\n') : '(none listed)'}

Liked tags/styles: ${likedTags.join(', ') || 'none yet'}
Disliked tags/styles: ${dislikedTags.join(', ') || 'none yet'}

Each recipe must be realistic to cook at home cheaply, include a real
protein source, and (for snacks/desserts) consider whether the vanilla
protein powder can be blended in undetectably. Vary the recipes from each
other -- different cuisines/proteins/cooking methods.
`.trim();
  const data = await generateJSON({ prompt, schema: recipeListSchema });
  return data.recipes;
}

// Homemade "ice cream"/frozen treat + other snack ideas using the Ninja
// blender + blender bottles (not a Creami), plus healthy-ish store-bought
// snack suggestions.
async function generateSnackIdeas({ count = 6, request = '', likedTags = [], dislikedTags = [] }) {
  const prompt = `
Generate ${count} snack ideas total, for two people, mixing:
(a) homemade snacks/treats made with a Ninja blender + blender bottles
    (protein shakes, blended "nice cream"/soft serve using frozen banana or
    Greek yogurt, overnight oats, energy bites, etc. -- no Ninja Creami),
    working in the vanilla protein powder undetectably where it fits, and
(b) healthy-ish snacks that are fine to just buy at the store (call these
    out clearly as store-bought, e.g. a specific product type/brand
    category, not a recipe).
${request ? `Specific request from the user: "${request}"` : ''}
Liked tags: ${likedTags.join(', ') || 'none yet'}
Disliked tags: ${dislikedTags.join(', ') || 'none yet'}

Keep everything cheap and low effort. These should feel like treats, not
punishment -- Eira especially likes ice cream, so lean into satisfying,
lower-sugar/lower-calorie frozen treat options rather than plain fruit.
`.trim();
  const data = await generateJSON({ prompt, schema: recipeListSchema });
  return data.recipes;
}

// Adds estimated nutrition + health tags + a "how to sneak the protein
// powder in" idea to a recipe pulled from an external source (TheMealDB)
// that has no nutrition info of its own.
async function tagExternalRecipe({ name, ingredients = [], instructions = '' }) {
  const prompt = `
Estimate nutrition and add health tags for this recipe (per serving, for 2
servings total unless it clearly serves more/fewer):

Name: ${name}
Ingredients: ${ingredients.join(', ')}
Instructions: ${instructions.slice(0, 1500)}

Also suggest one realistic way the vanilla protein powder could be worked
into this dish undetectably, or say "not a good fit" if there isn't one.
`.trim();
  return generateJSON({ prompt, schema: nutritionTagSchema });
}

module.exports = {
  suggestDailyMeal,
  generateRecipes,
  generateSnackIdeas,
  tagExternalRecipe,
};
