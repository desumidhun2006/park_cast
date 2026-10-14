# Parkistics frontend (v1 — Google Maps + live location)

Google Maps home page that centers on the person's current location, plus the full
spec UI (forecast slider, zone detail, trip planner, crowd reports, gamification).
Maps 1:1 to the planned React/Next.js components:

| v1 (`app.js` section) | React target |
|---|---|
| Google Maps + zone circles | `<ParkingMap>` + `<ZoneMarker>` |
| geolocation + 📍 button | `<LocateMe>` |
| time slider | `<TimeSlider>` heatmap evolution |
| `selectZone` detail panel | `<ZoneDetail>` probability curve, peaks, walk, price |
| Trip Planner | `<TripPlanner>` ranked zones + arrival windows + saved time |
| Crowd Report + `localStorage` points | `<CrowdReport>` + `<Gamification>` |

Run: `npx serve . -l 5173` → http://localhost:5173 (add `?api=http://localhost:4000` to force backend).
Works offline via embedded mock when backend is down.

## Google Maps API key (required for the live map)

The map needs a **browser** API key with **Maps JavaScript API** enabled:

1. https://console.cloud.google.com → new/existing project → enable billing
2. APIs & Services → enable **Maps JavaScript API**
3. Credentials → Create Credentials → API key (restrict to your site + localhost)

Then either (pick one):

- **Easiest:** open the site with the key in the URL (saved to the browser for next time):
  `http://localhost:5173/?gmaps_key=YOUR_KEY`
- **File:** `cp config.example.js config.js` and paste the key (never committed).

Without a key the map area shows setup instructions; everything else still works.
The browser will ask for location permission — allow it and the map centers on you.
