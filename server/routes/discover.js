const express = require('express');
const discover = require('../services/discover');
const sheets = require('../services/sheets');
const prefs = require('../services/preferences');
const { TABS } = require('../constants');

const router = express.Router();

// GET /api/discover/feed -> a batch of swipe cards (blend of real + AI recipes)
router.get('/feed', async (req, res) => {
  try {
    const [{ likedTags, dislikedTags }, pantryItems] = await Promise.all([
      prefs.getLikedDislikedTags(),
      prefs.getPantryItemNames(),
    ]);
    const count = Number(req.query.count) || 8;
    const cards = await discover.buildSwipeFeed({ likedTags, dislikedTags, pantryItems, count });
    res.json({ cards });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/discover/search?q=... -> the "search tab": search by what you
// have or want to eat, blending TheMealDB with AI-generated ideas
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    if (!query.trim()) return res.status(400).json({ error: 'q is required' });
    const [{ likedTags, dislikedTags }, pantryItems] = await Promise.all([
      prefs.getLikedDislikedTags(),
      prefs.getPantryItemNames(),
    ]);
    const cards = await discover.searchRecipes({ query, pantryItems, likedTags, dislikedTags });
    res.json({ cards });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/discover/swipe -> record a like/dislike so future suggestions improve
// body: { name, tags: [], liked: true|false, source }
router.post('/swipe', async (req, res) => {
  try {
    const body = req.body || {};
    const record = {
      RecipeName: body.name || '',
      Liked: body.liked ? 'TRUE' : 'FALSE',
      Source: body.source || '',
      Date: new Date().toISOString().slice(0, 10),
      Tags: Array.isArray(body.tags) ? body.tags.join(', ') : (body.tags || ''),
    };
    await sheets.appendRow(TABS.SWIPES, record);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/discover/tag -> on-demand nutrition estimate for one recipe
// (used when a real MealDB recipe is expanded and has no macros yet)
// body: { name, ingredients: [], instructions: [] }
router.post('/tag', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ error: 'name is required' });
    const tags = await discover.tagRecipe({
      name: body.name,
      ingredients: body.ingredients || [],
      instructions: Array.isArray(body.instructions) ? body.instructions.join(' ') : (body.instructions || ''),
    });
    res.json(tags);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
