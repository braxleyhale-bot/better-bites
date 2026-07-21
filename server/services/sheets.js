// Generic Google Sheets access layer, talking to the Sheets v4 REST API
// directly (via google-auth-library for the service-account token + plain
// fetch for the HTTP calls) rather than the full `googleapis` package,
// which is enormous and unnecessary for the handful of endpoints we need.
//
// Design: each tab's FIRST ROW is treated as headers. Every read returns an
// array of plain objects keyed by header name; every write takes a plain
// object and lines its fields up with whatever headers already exist in
// that tab. This means you can add/reorder columns in the Sheet itself
// without touching this code.

const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

let authClient = null;

function getAuth() {
  if (authClient) return authClient;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not set. See SETUP.md for how to create a service account key.'
    );
  }
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON could not be parsed as JSON. Make sure you pasted the whole key file contents on one line.'
    );
  }
  authClient = new GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return authClient;
}

async function authedFetch(url, options = {}) {
  const auth = getAuth();
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets API error (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

function assertSheetId() {
  if (!SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID is not set. See SETUP.md.');
  }
}

// Reads an entire tab and converts it to an array of objects keyed by the
// header row. Blank trailing cells in a row are treated as ''.
async function readTab(tabName) {
  assertSheetId();
  const url = `${API_BASE}/${SHEET_ID}/values/${encodeURIComponent(`${tabName}!A1:ZZ5000`)}`;
  const data = await authedFetch(url);
  const rows = data.values || [];
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows[0].map((h) => String(h).trim());
  const records = rows.slice(1).map((row, i) => {
    const obj = { _rowIndex: i + 2 }; // 1-based sheet row, +1 for header row
    headers.forEach((h, idx) => {
      obj[h] = row[idx] !== undefined ? row[idx] : '';
    });
    return obj;
  });
  return { headers, records };
}

// Appends one row to a tab, lining fields up with the existing header row.
async function appendRow(tabName, obj) {
  assertSheetId();
  const { headers } = await readTab(tabName);
  if (headers.length === 0) {
    throw new Error(
      `Tab "${tabName}" has no header row yet. Add column headers as row 1 first.`
    );
  }
  const row = headers.map((h) => (obj[h] !== undefined ? obj[h] : ''));
  const url = `${API_BASE}/${SHEET_ID}/values/${encodeURIComponent(`${tabName}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  await authedFetch(url, { method: 'POST', body: JSON.stringify({ values: [row] }) });
  return obj;
}

// Overwrites a specific row (1-based, including header row in the count)
// with new values, again lined up against the current headers.
async function updateRow(tabName, rowIndex, obj) {
  assertSheetId();
  const { headers } = await readTab(tabName);
  const row = headers.map((h) => (obj[h] !== undefined ? obj[h] : ''));
  const url = `${API_BASE}/${SHEET_ID}/values/${encodeURIComponent(`${tabName}!A${rowIndex}`)}?valueInputOption=USER_ENTERED`;
  await authedFetch(url, { method: 'PUT', body: JSON.stringify({ values: [row] }) });
}

// Clears a row's contents (does not delete the row, just blanks it out).
async function clearRow(tabName, rowIndex, numCols = 26) {
  assertSheetId();
  const endCol = String.fromCharCode(64 + numCols); // up to Z
  const url = `${API_BASE}/${SHEET_ID}/values/${encodeURIComponent(`${tabName}!A${rowIndex}:${endCol}${rowIndex}`)}:clear`;
  await authedFetch(url, { method: 'POST', body: JSON.stringify({}) });
}

module.exports = { readTab, appendRow, updateRow, clearRow };
