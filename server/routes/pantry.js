const express = require('express');
const sheets = require('../services/sheets');
const { TABS } = require('../constants');

const router = express.Router();

// GET /api/pantry -> list every pantry item
router.get('/', async (req, res) => {
  try {
    const { records } = await sheets.readTab(TABS.PANTRY);
    res.json({ items: records });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/pantry -> add a new item
// body: { Item, Category, Quantity, Unit, Location }
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.Item) return res.status(400).json({ error: 'Item is required' });
    const record = {
      Item: body.Item,
      Category: body.Category || '',
      Quantity: body.Quantity || '',
      Unit: body.Unit || '',
      Location: body.Location || '',
      LastUpdated: new Date().toISOString().slice(0, 10),
    };
    await sheets.appendRow(TABS.PANTRY, record);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/pantry/:rowIndex -> update an existing item (e.g. change quantity)
router.put('/:rowIndex', async (req, res) => {
  try {
    const rowIndex = Number(req.params.rowIndex);
    const body = req.body || {};
    const record = {
      Item: body.Item || '',
      Category: body.Category || '',
      Quantity: body.Quantity || '',
      Unit: body.Unit || '',
      Location: body.Location || '',
      LastUpdated: new Date().toISOString().slice(0, 10),
    };
    await sheets.updateRow(TABS.PANTRY, rowIndex, record);
    res.json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/pantry/:rowIndex -> clear a row (used up / no longer have it)
router.delete('/:rowIndex', async (req, res) => {
  try {
    await sheets.clearRow(TABS.PANTRY, Number(req.params.rowIndex));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
