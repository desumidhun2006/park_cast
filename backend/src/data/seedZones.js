// Seed zones — UC Berkeley / downtown pilot (lat/lng approx).
// Each zone: street block, lot, or cluster with capacity + price + POI context.
const seedZones = [
  {
    id: 'zone-mall-gateway',
    name: 'Gateway Mall Lot',
    kind: 'lot',
    center: { lat: 37.8725, lng: -122.2715 },
    polygon: [
      [37.8732, -122.2725],
      [37.8732, -122.2705],
      [37.8718, -122.2705],
      [37.8718, -122.2725]
    ],
    capacity: 220,
    pricePerHour: 2.5,
    walkTo: [{ label: 'Gateway Mall', minutes: 3 }, { label: 'Transit Stop', minutes: 6 }],
    peakHours: 'Weekdays 17-19 full, empties after 20',
    poiTags: ['mall', 'retail']
  },
  {
    id: 'zone-campus-north',
    name: 'Campus North St Block',
    kind: 'street',
    center: { lat: 37.8745, lng: -122.2735 },
    polygon: [],
    capacity: 45,
    pricePerHour: 1.5,
    walkTo: [{ label: 'North Gate', minutes: 2 }, { label: 'Library', minutes: 7 }],
    peakHours: 'Weekdays 9-15 busy, evenings free',
    poiTags: ['university']
  },
  {
    id: 'zone-telegraph',
    name: 'Telegraph Commercial Strip',
    kind: 'street',
    center: { lat: 37.8685, lng: -122.2585 },
    polygon: [],
    capacity: 60,
    pricePerHour: 2.0,
    walkTo: [{ label: 'Cafes', minutes: 1 }, { label: 'Music Venue', minutes: 4 }],
    peakHours: 'Fri/Sat 19-23 scarce',
    poiTags: ['food', 'nightlife']
  },
  {
    id: 'zone-station',
    name: 'Downtown Station Lot',
    kind: 'lot',
    center: { lat: 37.8705, lng: -122.2685 },
    polygon: [],
    capacity: 150,
    pricePerHour: 3.0,
    walkTo: [{ label: 'BART Station', minutes: 2 }, { label: 'City Hall', minutes: 8 }],
    peakHours: 'Weekday commute 7-9, 16-18 tight',
    poiTags: ['transit']
  },
  {
    id: 'zone-residential-south',
    name: 'South Residential Cluster',
    kind: 'cluster',
    center: { lat: 37.8655, lng: -122.2715 },
    polygon: [],
    capacity: 80,
    pricePerHour: 0,
    walkTo: [{ label: 'South Campus', minutes: 10 }],
    peakHours: 'Overnight ample, Sun evening tight',
    poiTags: ['residential']
  },
  {
    id: 'zone-hospital-east',
    name: 'Hospital East Lot',
    kind: 'lot',
    center: { lat: 37.8735, lng: -122.2645 },
    polygon: [],
    capacity: 120,
    pricePerHour: 4.0,
    walkTo: [{ label: 'Hospital', minutes: 3 }],
    peakHours: 'Weekdays 10-16 busy',
    poiTags: ['hospital']
  }
];

module.exports = { seedZones };
