# Parkistics frontend (v2 — free map + live location)

Leaflet + OpenStreetMap home page that centers on the person's current location —
**no API key, no signup, no cost**. Google Maps becomes the map provider automatically
if a key is configured. Implements the full spec UI (forecast slider, zone detail,
trip planner, crowd reports, gamification). Maps 1:1 to the planned React/Next.js
components:

| v2 (`app.js` section) | React target |
|---|---|
| Leaflet/Google provider + zone markers | `<ParkingMap>` + `<ZoneMarker>` |
| geolocation + 📍 button | `<LocateMe>` |
| time slider | `<TimeSlider>` heatmap evolution |
| `selectZone` detail panel | `<ZoneDetail>` probability curve, peaks, walk, price |
| Trip Planner | `<TripPlanner>` ranked zones + arrival windows + saved time |
| Crowd Report + `localStorage` points | `<CrowdReport>` + `<Gamification>` |

Run: `npx serve . -l 5173` → http://localhost:5173 (add `?api=http://localhost:4000` to force backend).
Works offline via embedded mock when backend is down (map tiles need internet).

## Optional: Google Maps upgrade

If you later have a browser key with **Maps JavaScript API** enabled, either:

- open the site with `?gmaps_key=YOUR_KEY` (saved in the browser), or
- `cp config.example.js config.js` and paste the key (never committed).

The browser will ask for location permission — allow it and the map centers on you.
See `docs/GOOGLE_MAPS_KEY.md` for how to create a key.
