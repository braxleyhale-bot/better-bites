require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// API routes
app.use('/api/pantry', require('./routes/pantry'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/mealplan', require('./routes/mealplan'));
app.use('/api/discover', require('./routes/discover'));
app.use('/api/suggestion', require('./routes/suggestion'));
app.use('/api/snacks', require('./routes/snacks'));

// Basic health check (useful for confirming Render deploy + env vars are ok)
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasSheetId: !!process.env.GOOGLE_SHEET_ID,
    hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  });
});

// Serve the frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Better Bites server running on port ${PORT}`);
});
