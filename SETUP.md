# Better Bites — Setup Guide

This gets your meal planner live on the web. No coding required, just
following steps. Budget: everything below is free.

## What you'll end up with

- A private web page (hosted on Render) you and Eira can open from any
  device to search recipes, swipe on new ideas, plan the week, and get
  snack ideas.
- A Google Sheet that acts as the app's memory: your pantry, saved
  recipes, weekly plan, and swipe history.
- Gemini (free tier) powering the AI suggestions.

Total setup time: roughly 30-45 minutes, one time.

---

## Step 1 — Get a Gemini API key (5 min)

This is different from your Gemini Pro subscription — it's a free
developer key that lets the app call Gemini on your behalf.

1. Go to https://aistudio.google.com/apikey
2. Sign in with your Google account.
3. Click **Create API key**.
4. Copy the key somewhere safe (looks like `AIzaSy...`). You'll paste it
   in Step 4.

The free tier is generous for two people using this daily — if you ever
hit a rate limit, the app will just show an error for that one request.

---

## Step 2 — Create the Google Sheet (5 min)

1. Take the file **BetterBites-GoogleSheet-Template.xlsx** (included in
   this project) and upload it to Google Sheets:
   - Go to https://sheets.google.com
   - Click the folder icon (Open file picker) → **Upload** tab → select
     the xlsx file. Google converts it to a native Sheet automatically.
2. Rename the file to whatever you want (e.g. "Better Bites Data").
3. Read the "Read Me First" tab, then delete the italic example row on
   each tab once you understand the format.
4. Copy the **Sheet ID** out of the browser URL. The URL looks like:
   `https://docs.google.com/spreadsheets/d/`**`1AbCdEfGhIjKlMnOpQrStUvWxYz`**`/edit`
   The bolded part is your Sheet ID — save it for Step 4.

---

## Step 3 — Create a Google service account (15 min)

A "service account" is a robot Google account that only your app uses to
read/write your Sheet — it never touches your personal Google login.

1. Go to https://console.cloud.google.com/ and sign in.
2. Click the project dropdown at the top → **New Project** → name it
   `better-bites` → **Create**. Make sure it's selected once created.
3. In the search bar at the top, search for **Google Sheets API** → open
   it → click **Enable**.
4. In the left sidebar, go to **APIs & Services > Credentials**.
5. Click **Create Credentials > Service account**.
   - Name it `better-bites-bot` → **Create and Continue** → skip the
     optional role/access steps → **Done**.
6. On the Credentials page, click the service account you just made.
7. Go to the **Keys** tab → **Add Key > Create new key** → choose
   **JSON** → **Create**. A `.json` file downloads to your computer —
   keep it private, don't share or upload it publicly.
8. Open that JSON file in a text editor. You'll paste its *entire
   contents* as one line into an environment variable in Step 4.
9. Copy the service account's email address (looks like
   `better-bites-bot@better-bites-123456.iam.gserviceaccount.com` — you
   can find it in the JSON file as `client_email`, or on the Credentials
   page).
10. Go back to your Google Sheet from Step 2 → click **Share** → paste
    that service account email → set permission to **Editor** → **Send**
    (it won't actually email anyone, it just grants access).

---

## Step 4 — Deploy to Render (10-15 min)

Render will host the app so it's reachable from any browser.

1. Put this project on GitHub:
   - Create a free account at https://github.com if you don't have one.
   - Create a new repository (e.g. `better-bites`).
   - Upload this whole project folder to that repository (GitHub's web
     uploader works fine — drag the folder contents in, or use GitHub
     Desktop if you prefer a GUI).
   - **Do not upload your `.env` file or the service account JSON file**
     — they contain secrets. The included `.gitignore` already keeps
     `.env` out if you use git directly.
2. Go to https://render.com and sign up (free), connecting your GitHub
   account when prompted.
3. Click **New > Web Service**, select your `better-bites` repository.
4. Render should detect `render.yaml` automatically and pre-fill the
   settings (Node, `npm install`, `npm start`). If not, set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment Variables**, add:
   - `GEMINI_API_KEY` → the key from Step 1
   - `GOOGLE_SHEET_ID` → the Sheet ID from Step 2
   - `GOOGLE_SERVICE_ACCOUNT_JSON` → paste the *entire* contents of the
     JSON key file from Step 3, as one line
   - `PEXELS_API_KEY` → optional, see "Real photos for AI recipes" below
6. Click **Create Web Service**. First deploy takes a couple of minutes.
7. Once it's live, open the URL Render gives you (something like
   `https://better-bites.onrender.com`) — that's your app.
8. Visit `https://better-bites.onrender.com/api/health` — it should show
   `hasGeminiKey`, `hasSheetId`, and `hasServiceAccount` all as `true`.
   If any is `false`, double check that environment variable in Render.

Note: Render's free tier "spins down" a service after 15 minutes of no
traffic, so the first load after a while takes ~30-60 seconds to wake
back up. That's normal and free.

---

## Running it locally first (optional, for testing)

If you want to test on your own computer before deploying:

1. Install Node.js (18+) from https://nodejs.org if you don't have it.
2. In this project folder, copy `.env.example` to `.env` and fill in the
   three values from Steps 1-3.
3. Open a terminal in this folder and run:
   ```
   npm install
   npm start
   ```
4. Open http://localhost:3000 in your browser.

---

## Real photos for AI recipes (optional)

Recipes Gemini invents don't come with a photo of their own — without any
setup, those cards just show a food emoji instead of a picture, which is
fine but less nice to look at. If you want real photos on those cards too:

1. Go to https://www.pexels.com/api/ and sign up (free).
2. Copy your API key from your Pexels account page.
3. Set it as `PEXELS_API_KEY` in your `.env` file (local) or Render's
   environment variables (deployed).

This is entirely optional and free (200 requests/hour, 20,000/month) —
recipes from TheMealDB already have real photos either way, this only
affects the AI-invented ones.

---

## Real Ninja Combi recipes (Discover tab)

There's a "🔍 Real Ninja Combi recipes" button on the Discover tab. Unlike
the rest of the app, this doesn't ask Gemini to invent recipes — it uses
Gemini's Google Search grounding to actually search the web for real,
published Ninja Combi / Ninja Foodi recipes and pulls those in, with a
link back to where each one came from.

Two things worth knowing:
- It's noticeably slower than a normal feed refresh (it's doing a real web
  search plus two AI calls), which is why it's a separate button instead
  of running automatically every time you open Discover.
- Google's Search grounding tool is billed per search query on top of the
  normal free Gemini tier, so this specific button may use a small amount
  of paid quota once you exceed AI Studio's free allowance — normal
  recipe generation elsewhere in the app is unaffected. Use it as often as
  you like; the cost per search is small, but it's worth knowing it's not
  covered by the same "free tier" umbrella as everything else.

---

## How the AI decisions work (so it makes sense when you use it)

- **Search tab** — you type what you have or want, the app pulls real
  recipes from a free recipe database (TheMealDB) and also asks Gemini to
  invent a few tailored ideas, blending both.
- **Discover tab** — same idea, but shown one at a time to swipe. Likes
  get auto-saved to your recipe book; the app also remembers which tags
  (cuisine, protein, style) you tend to like or skip, and feeds that back
  into future suggestions and the "tonight" suggestion.
- **Tonight's suggestion** — looks at what you've actually eaten over the
  past week (from your calendar) and nudges lighter if things have been
  heavy/repetitive, or lets you splurge a bit if you've been eating light.
  It also actively avoids suggesting a cuisine/protein you've had twice
  already that week.
- **Snacks tab** — mixes homemade ideas using your Ninja blender +
  blender bottles (including frozen "nice cream" style treats using the
  vanilla protein powder undetectably) with honest "just buy this at the
  store" suggestions — it's not trying to make you cook everything.
- **Budget** — every AI-generated recipe includes a rough cost estimate,
  and the AI is instructed to keep the household's total food spend under
  $500/month in mind when suggesting ingredients.

## Keeping costs at $0

- Gemini API free tier: no cost for this household's usage level.
- TheMealDB: free, no key required.
- Render free web service tier: no cost (with the spin-down tradeoff
  noted above).
- Google Sheets/Cloud service account: free.

If you ever want zero spin-down delay, Render's cheapest paid tier is a
few dollars a month — entirely optional.
