const express = require('express');
const sheets = require('../services/sheets');
const { TABS } = require('../constants');

const router = express.Router();

// GET /api/mealplan -> the whole plan (frontend filters to the week it's showing)
router.get('/', async (req, res) => {
  try {
    const { records } = await sheets.readTab(TABS.MEALPLAN);
    res.json({ plan: records });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/mealplan -> assign a recipe to a date
// body: { Date: 'YYYY-MM-DD', MealSlot: 'Dinner', RecipeID, RecipeName, Notes }
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.Date || !body.RecipeName) {
      return res.status(400).json({ error: 'Date and RecipeName are required' });
    }
    const record = {
      Date: body.Date,
      MealSlot: body.MealSlot || 'Dinner',
      RecipeID: body.RecipeID || '',
      RecipeName: body.RecipeName,
      Notes: body.Notes || '',
    };
    await sheets.appendRow(TABS.MEALPLAN, record);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/mealplan/:rowIndex -> remove a planned meal
router.delete('/:rowIndex', async (req, res) => {
  try {
    await sheets.clearRow(TABS.MEALPLAN, Number(req.params.rowIndex));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
