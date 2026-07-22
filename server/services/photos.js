// Optional food photo lookup via the Pexels API (free, no cost, ~200
// requests/hour). Entirely optional: if PEXELS_API_KEY isn't set, every
// call here just returns null and the frontend falls back to a food-emoji
// tile instead of a photo -- nothing breaks either way.

const fetch = require('node-fetch');

async function getPhotoUrl(query) {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(`${query} food`)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.photos && data.photos[0];
    if (!photo || !photo.src) return null;
    return photo.src.large || photo.src.medium || photo.src.original || null;
  } catch (e) {
    return null;
  }
}

module.exports = { getPhotoUrl };
