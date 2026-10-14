# Getting a Google Maps API Key (optional upgrade for the Parkistics live map)

> **Note:** Parkistics now uses a free OpenStreetMap map by default — no key needed.
> This guide is only for switching the map provider to Google Maps later.
> Google requires a billing account (card), though the $200/month free credit covers
> local development and small pilots.

Takes ~5 minutes. You need a Google account. Google requires billing to be enabled,
but the Maps JavaScript API includes a recurring **$200/month free credit**, which
covers far more than local development and small pilots — you won't be charged
unless you exceed it.

## Step 1 — Open Google Cloud Console

Go to https://console.cloud.google.com/ and sign in.

## Step 2 — Create (or select) a project

1. Click the project dropdown at the top → **New Project**.
2. Name it e.g. `parkistics` → **Create**. Wait for it to finish, then select it.

## Step 3 — Enable billing

1. Open the ☰ menu → **Billing**.
2. **Link a billing account** (create one if needed — card required, free credit applies).
3. Make sure your `parkistics` project is linked to it.

## Step 4 — Enable the Maps JavaScript API

1. ☰ menu → **APIs & Services → Library**.
2. Search **"Maps JavaScript API"** → click it → **Enable**.

## Step 5 — Create the API key

1. Go to **APIs & Services → Credentials**.
2. **+ Create Credentials → API key**. Copy the key (starts with `AIza...`).

## Step 6 — Restrict the key (recommended)

On the key's page:

- **Application restrictions → HTTP referrers (web sites)**, add:
  - `http://localhost:*/*`
  - `http://127.0.0.1:*/*`
  - your deployed domain later, e.g. `https://your-site.com/*`
- **API restrictions → Restrict key → select only "Maps JavaScript API"**.
- **Save.**

## Step 7 — Use it in Parkistics (pick one)

- **Easiest:** open the site once with the key in the URL
  (it's saved in the browser for future visits):
  `http://localhost:5173/?gmaps_key=PASTE_KEY_HERE`
- **File:** `cp frontend/config.example.js frontend/config.js`,
  paste the key in `config.js` (this file is gitignored — never committed).

Reload the page, allow the location prompt, and the map centers on you.

## Troubleshooting

| What you see | Cause → Fix |
|---|---|
| Map area shows "needs an API key" notice | No key configured → do Step 7 |
| `RefererNotAllowedMapError` in console | Current URL not in key's HTTP-referrer list → Step 6, add it |
| `ApiNotActivatedMapError` | Maps JavaScript API not enabled → Step 4 |
| `InvalidKeyMapError` | Typo in key or key deleted → regenerate in Credentials |
| Map loads but location stays on default area | Location permission denied → click **📍 Use my location** and Allow |
| Billing error on enable | Project not linked to a billing account → Step 3 |

To remove a stored key from the browser: open
`http://localhost:5173/?gmaps_key=` (empty value clears it).
