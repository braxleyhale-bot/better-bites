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

async function getRandomMeals(count = 5) {
  // random.php only ever returns one meal per call, so fire off several
  // requests in parallel and de-dupe by id.
  const calls = Array.from({ length: count + 3 }, () => fetch(`${BASE}/random.php`).then((r) => r.json()));
  const results = await Promise.all(calls);
  const seen = new Set();
  const meals = [];
  for (const r of results) {
    const meal = r && r.meals && r.meals[0];
    if (meal && !seen.has(meal.idMeal)) {
      seen.add(meal.idMeal);
      meals.push(normalize(meal));
    }
    if (meals.length >= count) break;
  }
  return meals;
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
