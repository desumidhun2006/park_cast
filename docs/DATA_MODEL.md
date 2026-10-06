# ParkCast data model (MongoDB)

## `zones`
Geo + metadata per parking zone (street block / lot / cluster).
`{ zoneId, name, kind: street|lot|cluster, center: {lat,lng}, polygon: [[lat,lng]], capacity, pricePerHour, walkTo: [{label, minutes}], peakHours, poiTags: [] }`

## `parking_events`
Historical + inferred occupancy.
`{ zoneId, observedAt, occupancyLevel: 0..1, source: open-data|proxy|inferred|crowd }`
Sources: city open-data portals, OSM geometries, traffic indices, weather/transit optionally.

## `user_reports`
Anonymous crowd signals.
`{ zoneId, signal: found|full|circling, note?, createdAt }`
`found` = “found a spot”, `full` = “no luck, all full”, `circling` = “circling > 5 min”.

## `predictions`
Model outputs per zone/time window.
`{ zoneId, time, horizonMin: 15|30|60|..., probability: 0..1, confidence: 0..1, modelVersion }`

## `users`
`{ displayName, points, badges: [], preferences: { homeZone?, maxWalkMin?, maxPrice? } }`
Gamification: +10 pts/report; badges Reporter (10), Contributor (50), Scout (100). No personal data required.
