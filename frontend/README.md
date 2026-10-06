# ParkCast frontend (v0 static prototype)

Leaflet + vanilla JS prototype implementing the full spec so it can be visually tested today. Maps 1:1 to the planned React/Next.js components:

| v0 (`app.js` section) | React target |
|---|---|
| `renderZones` + Leaflet markers | `<ParkingMap>` + `<ZoneMarker>` (Mapbox/Leaflet) |
| time slider | `<TimeSlider>` heatmap evolution |
| `selectZone` detail panel | `<ZoneDetail>` probability curve, peaks, walk, price |
| Trip Planner | `<TripPlanner>` ranked zones + arrival windows + saved time |
| Crowd Report + `localStorage` points | `<CrowdReport>` + `<Gamification>` |

Run: `npx serve . -l 5173` → http://localhost:5173 (add `?api=http://localhost:4000` to force backend).
Works offline via embedded mock when backend is down.
