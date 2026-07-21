const express = require('express');
const sheets = require('../services/sheets');
const { TABS } = require('../constants');

const router = express.Router();

function newId() {
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// GET /api/recipes -> the saved recipe book
router.get('/', async (req, res) => {
  try {
    const { records } = await sheets.readTab(TABS.RECIPES);
    res.json({ recipes: records });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/recipes -> save a recipe (from swipe, search, or an AI
// suggestion) into the permanent recipe book.
// body matches the "card" shape produced by discover.js / gemini.js
router.post('/', async (req, res) => {
  try {
    const r = req.body || {};
    if (!r.name) return res.status(400).json({ error: 'name is required' });
    const record = {
      ID: r.id || newId(),
      Name: r.name,
      Ingredients: Array.isArray(r.ingredients) ? r.ingredients.join(' | ') : (r.ingredients || ''),
      Instructions: Array.isArray(r.instructions) ? r.instructions.join(' | ') : (r.instructions || ''),
      Tags: Array.isArray(r.tags) ? r.tags.join(', ') : (r.tags || ''),
      Source: r.source || 'Manual',
      Calories: r.estCaloriesPerServing ?? '',
      ProteinG: r.estProteinG ?? '',
      SodiumMg: r.estSodiumMg ?? '',
      CarbsG: r.estCarbsG ?? '',
      EstCostUSD: r.estCostUsd ?? '',
      UsesNinjaCombi: r.usesNinjaCombi ? 'Yes' : 'No',
      UsesBlender: r.usesBlender ? 'Yes' : 'No',
      DateAdded: new Date().toISOString().slice(0, 10),
    };
    await sheets.appendRow(TABS.RECIPES, record);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/recipes/:rowIndex -> remove a recipe from the book
router.delete('/:rowIndex', async (req, res) => {
  try {
    await sheets.clearRow(TABS.RECIPES, Number(req.params.rowIndex));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
