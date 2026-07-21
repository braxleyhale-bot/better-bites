// Reads the SwipeHistory tab and boils it down into simple liked/disliked
// tag lists the AI prompts can use, plus a plain list of recent meal names
// pulled from the MealPlan tab (used to avoid "tacos 5 nights a week").

const sheets = require('./sheets');
const { TABS } = require('../constants');

function topTags(records, liked, limit = 12) {
  const counts = {};
  records
    .filter((r) => (String(r.Liked).toLowerCase() === 'true') === liked)
    .forEach((r) => {
      String(r.Tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => {
          counts[t] = (counts[t] || 0) + 1;
        });
    });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([t]) => t);
}

async function getLikedDislikedTags() {
  try {
    const { records } = await sheets.readTab(TABS.SWIPES);
    return { likedTags: topTags(records, true), dislikedTags: topTags(records, false) };
  } catch (e) {
    return { likedTags: [], dislikedTags: [] };
  }
}

async function getRecentMeals(days = 7) {
  try {
    const { records } = await sheets.readTab(TABS.MEALPLAN);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return records
      .filter((r) => r.Date && new Date(r.Date) >= cutoff && r.RecipeName)
      .sort((a, b) => new Date(b.Date) - new Date(a.Date))
      .map((r) => `${r.Date}: ${r.RecipeName}`);
  } catch (e) {
    return [];
  }
}

async function getPantryItemNames() {
  try {
    const { records } = await sheets.readTab(TABS.PANTRY);
    return records.filter((r) => r.Item).map((r) => `${r.Item}${r.Quantity ? ` (${r.Quantity}${r.Unit ? ' ' + r.Unit : ''})` : ''}`);
  } catch (e) {
    return [];
  }
}

module.exports = { getLikedDislikedTags, getRecentMeals, getPantryItemNames };
