const express = require('express');
const gemini = require('../services/gemini');
const prefs = require('../services/preferences');
const { toCard, attachPhotos } = require('../services/discover');

const router = express.Router();

// GET /api/suggestion/today -> "what should we eat tonight", aware of what
// you've eaten recently so it doesn't just say tacos again.
router.get('/today', async (req, res) => {
  try {
    const [recentMeals, pantryItems, { likedTags, dislikedTags }] = await Promise.all([
      prefs.getRecentMeals(7),
      prefs.getPantryItemNames(),
      prefs.getLikedDislikedTags(),
    ]);
    const suggestion = await gemini.suggestDailyMeal({ recentMeals, pantryItems, likedTags, dislikedTags });
    if (suggestion.recipe) {
      const card = toCard(suggestion.recipe);
      await attachPhotos([card]);
      suggestion.recipe = card;
    }
    res.json(suggestion);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
