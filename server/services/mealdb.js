// Thin wrapper around TheMealDB's free public API (test key "1", no
// signup/key needed). Used as the "real recipes from the internet" half of
// the swipe-discovery feed. https://www.themealdb.com/api.php

const fetch = require('node-fetch');

const BASE = 'https://www.themealdb.com/api/json/v1/1';

function normalize(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i += 1) {
    const ing = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (ing && ing.trim()) {
      ingredients.push(`${measure ? measure.trim() + ' ' : ''}${ing.trim()}`);
    }
  }
  return {
    externalId: meal.idMeal,
    name: meal.strMeal,
    summary: `${meal.strArea || ''} ${meal.strCategory || ''}`.trim(),
    ingredients,
    instructions: (meal.strInstructions || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    image: meal.strMealThumb,
    tags: [meal.strCategory, meal.strArea, ...(meal.strTags ? meal.strTags.split(',') : [])].filter(Boolean),
    source: 'TheMealDB',
    sourceUrl: meal.strSource || meal.strYoutube || `https://www.themealdb.com/meal/${meal.idMeal}`,
  };
}

// TheMealDB's random.php pulls from every category with no way to filter,
// which is how "Discover" ended up serving desserts and breakfast pastries
// for dinner. This app is about dinner (and leftovers), so random picks
// are restricted to categories that are actually dinner-appropriate.
const DINNER_CATEGORIES = ['Chicken', 'Beef', 'Seafood', 'Pasta', 'Pork', 'Vegetarian', 'Vegan', 'Lamb', 'Miscellaneous', 'Goat'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function getRandomMeals(count = 5) {
  // Sample a handful of dinner-appropriate categories, pull their meal
  // lists (id/name/thumb only), then randomly select `count` of them and
  // fetch full details for just those.
  const categoriesToTry = shuffle(DINNER_CATEGORIES).slice(0, 4);
  const lists = await Promise.all(
    categoriesToTry.map((c) =>
      fetch(`${BASE}/filter.php?c=${encodeURIComponent(c)}`)
        .then((r) => r.json())
        .then((d) => d.meals || [])
        .catch(() => [])
    )
  );
  const candidates = shuffle(lists.flat());
  const seen = new Set();
  const picked = [];
  for (const m of candidates) {
    if (seen.has(m.idMeal)) continue;
    seen.add(m.idMeal);
    picked.push(m);
    if (picked.length >= count) break;
  }
  const full = await Promise.all(
    picked.map((m) => fetch(`${BASE}/lookup.php?i=${m.idMeal}`).then((res) => res.json()))
  );
  return full.map((f) => f.meals && f.meals[0]).filter(Boolean).map(normalize);
}

async function searchByName(query) {
  const r = await fetch(`${BASE}/search.php?s=${encodeURIComponent(query)}`).then((res) => res.json());
  return (r.meals || []).map(normalize);
}

async function searchByIngredient(ingredient) {
  const r = await fetch(`${BASE}/filter.php?i=${encodeURIComponent(ingredient)}`).then((res) => res.json());
  // filter.php returns partial meal objects (no ingredients/instructions),
  // so look up full details for each match.
  const partials = (r.meals || []).slice(0, 12);
  const full = await Promise.all(
    partials.map((m) => fetch(`${BASE}/lookup.php?i=${m.idMeal}`).then((res) => res.json()))
  );
  return full.map((f) => f.meals && f.meals[0]).filter(Boolean).map(normalize);
}

module.exports = { getRandomMeals, searchByName, searchByIngredient };
