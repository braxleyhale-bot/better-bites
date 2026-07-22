const express = require('express');
const gemini = require('../services/gemini');
const prefs = require('../services/preferences');
const { toCard, attachPhotos } = require('../services/discover');

const router = express.Router();

// GET /api/snacks?request=... -> snack tab: homemade blender treats
// (including ice-cream-style ones) + healthy store-bought suggestions
router.get('/', async (req, res) => {
  try {
    const { likedTags, dislikedTags } = await prefs.getLikedDislikedTags();
    const recipes = await gemini.generateSnackIdeas({
      count: 6,
      request: req.query.request || '',
      likedTags,
      dislikedTags,
    });
    const cards = recipes.map(toCard);
    await attachPhotos(cards);
    res.json({ cards });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
