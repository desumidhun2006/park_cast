// Expanded Parking Dataset — comprehensive coverage of parking zones, garages, and streets
// Each zone includes geographical coordinates, real capacities, hourly pricing, walking distances, POI tags, and peak patterns.
const seedZones = [
  // --- Core Downtown & Pilot Zones ---
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
    poiTags: ['mall', 'retail', 'downtown']
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
    poiTags: ['university', 'campus']
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
    poiTags: ['food', 'nightlife', 'telegraph']
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
    poiTags: ['transit', 'downtown']
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
  },

  // --- Extended Downtown & Civic Garages ---
  {
    id: 'zone-center-garage',
    name: 'Center Street Public Garage',
    kind: 'garage',
    center: { lat: 37.8698, lng: -122.2682 },
    polygon: [],
    capacity: 380,
    pricePerHour: 3.5,
    walkTo: [{ label: 'Downtown Plaza', minutes: 1 }, { label: 'Arts District', minutes: 3 }],
    peakHours: 'Weekdays 11-18 high turnover, event nights full',
    poiTags: ['garage', 'downtown', 'arts', 'ev-charging']
  },
  {
    id: 'zone-kittredge-garage',
    name: 'Kittredge Multi-Level Garage',
    kind: 'garage',
    center: { lat: 37.8682, lng: -122.2648 },
    polygon: [],
    capacity: 290,
    pricePerHour: 3.0,
    walkTo: [{ label: 'Public Library', minutes: 2 }, { label: 'Cinema', minutes: 3 }],
    peakHours: 'Friday & Saturday 18-22 busy',
    poiTags: ['garage', 'downtown', 'cinema']
  },
  {
    id: 'zone-civic-center',
    name: 'Civic Center MLK Plaza Lot',
    kind: 'lot',
    center: { lat: 37.8695, lng: -122.2735 },
    polygon: [],
    capacity: 180,
    pricePerHour: 2.5,
    walkTo: [{ label: 'City Hall', minutes: 2 }, { label: 'Post Office', minutes: 4 }],
    peakHours: 'Saturday Farmers Market 9-14 full',
    poiTags: ['civic', 'farmers-market', 'downtown']
  },
  {
    id: 'zone-shattuck-meters',
    name: 'Shattuck Avenue Metered Row',
    kind: 'street',
    center: { lat: 37.8722, lng: -122.2690 },
    polygon: [],
    capacity: 95,
    pricePerHour: 2.75,
    walkTo: [{ label: 'Boutique Row', minutes: 1 }, { label: 'Cafes', minutes: 2 }],
    peakHours: 'Lunch 12-14 and Dinner 18-21 busy',
    poiTags: ['dining', 'street', 'downtown']
  },

  // --- Campus & University Perimeter ---
  {
    id: 'zone-bancroft-meter',
    name: 'Bancroft Way Campus Bay',
    kind: 'street',
    center: { lat: 37.8687, lng: -122.2568 },
    polygon: [],
    capacity: 70,
    pricePerHour: 2.5,
    walkTo: [{ label: 'Student Union', minutes: 2 }, { label: 'Sproul Plaza', minutes: 3 }],
    peakHours: 'Weekdays 10-16 scarce',
    poiTags: ['campus', 'student-union', 'university']
  },
  {
    id: 'zone-oxford-tract',
    name: 'Oxford Street Northside Strip',
    kind: 'street',
    center: { lat: 37.8738, lng: -122.2662 },
    polygon: [],
    capacity: 55,
    pricePerHour: 2.25,
    walkTo: [{ label: 'University Hall', minutes: 2 }, { label: 'Sciences Hub', minutes: 5 }],
    peakHours: 'Weekdays 9-14 tight',
    poiTags: ['campus', 'street']
  },
  {
    id: 'zone-greek-theatre',
    name: 'Greek Theatre & Foothill Lot',
    kind: 'lot',
    center: { lat: 37.8742, lng: -122.2538 },
    polygon: [],
    capacity: 175,
    pricePerHour: 4.5,
    walkTo: [{ label: 'Greek Theatre', minutes: 2 }, { label: 'Engineering Quad', minutes: 5 }],
    peakHours: 'Concert & event nights 17-23 full',
    poiTags: ['theatre', 'events', 'campus']
  },
  {
    id: 'zone-memorial-stadium',
    name: 'Memorial Stadium Rim Bay',
    kind: 'lot',
    center: { lat: 37.8708, lng: -122.2505 },
    polygon: [],
    capacity: 140,
    pricePerHour: 4.0,
    walkTo: [{ label: 'Stadium Gates', minutes: 2 }, { label: 'Panoramic Hill', minutes: 8 }],
    peakHours: 'Game days 10-19 saturated',
    poiTags: ['stadium', 'athletics', 'events']
  },
  {
    id: 'zone-clark-kerr',
    name: 'Clark Kerr Campus Surface Lot',
    kind: 'lot',
    center: { lat: 37.8648, lng: -122.2475 },
    polygon: [],
    capacity: 130,
    pricePerHour: 2.0,
    walkTo: [{ label: 'Clark Kerr Quads', minutes: 3 }, { label: 'Track Field', minutes: 5 }],
    peakHours: 'Weekday afternoons 14-18 moderate',
    poiTags: ['residential', 'athletics']
  },

  // --- Elmwood & Telegraph South ---
  {
    id: 'zone-elmwood-college',
    name: 'Elmwood College Avenue District',
    kind: 'street',
    center: { lat: 37.8595, lng: -122.2528 },
    polygon: [],
    capacity: 85,
    pricePerHour: 2.0,
    walkTo: [{ label: 'Ashby Stage', minutes: 2 }, { label: 'Elmwood Shops', minutes: 1 }],
    peakHours: 'Saturday & Sunday 11-17 tight',
    poiTags: ['elmwood', 'retail', 'cafes']
  },
  {
    id: 'zone-ashby-bart',
    name: 'Ashby Station Park & Ride',
    kind: 'lot',
    center: { lat: 37.8532, lng: -122.2698 },
    polygon: [],
    capacity: 420,
    pricePerHour: 3.0,
    walkTo: [{ label: 'Ashby BART Concourse', minutes: 1 }, { label: 'Ed Roberts Center', minutes: 2 }],
    peakHours: 'Weekday morning commute 7-9 full',
    poiTags: ['transit', 'commute', 'bart']
  },

  // --- North Berkeley & Gourmet Ghetto ---
  {
    id: 'zone-gourmet-ghetto',
    name: 'Gourmet Ghetto North Shattuck',
    kind: 'street',
    center: { lat: 37.8795, lng: -122.2695 },
    polygon: [],
    capacity: 75,
    pricePerHour: 2.5,
    walkTo: [{ label: 'Famous Eateries', minutes: 1 }, { label: 'Artisan Bakeries', minutes: 2 }],
    peakHours: 'Lunch 12-14 and Dinner 18-21 scarce',
    poiTags: ['dining', 'culinary', 'north-berkeley']
  },
  {
    id: 'zone-north-berkeley-bart',
    name: 'North Berkeley Transit Hub',
    kind: 'lot',
    center: { lat: 37.8739, lng: -122.2835 },
    polygon: [],
    capacity: 350,
    pricePerHour: 3.0,
    walkTo: [{ label: 'North Berkeley BART', minutes: 1 }, { label: 'Cedar Rose Park', minutes: 6 }],
    peakHours: 'Weekday mornings 6:30-8:30 full',
    poiTags: ['transit', 'commute', 'bart']
  },
  {
    id: 'zone-solano-avenue',
    name: 'Solano Avenue Commercial Way',
    kind: 'street',
    center: { lat: 37.8918, lng: -122.2825 },
    polygon: [],
    capacity: 90,
    pricePerHour: 1.5,
    walkTo: [{ label: 'Solano Boutiques', minutes: 1 }, { label: 'Bookstores', minutes: 3 }],
    peakHours: 'Weekends 12-17 active',
    poiTags: ['retail', 'family', 'dining']
  },

  // --- West Berkeley & Marina District ---
  {
    id: 'zone-fourth-street',
    name: 'Fourth Street Shopping Promenade',
    kind: 'lot',
    center: { lat: 37.8692, lng: -122.3005 },
    polygon: [],
    capacity: 210,
    pricePerHour: 1.5,
    walkTo: [{ label: 'Fourth St Retailers', minutes: 2 }, { label: 'Apple Fourth St', minutes: 3 }],
    peakHours: 'Saturdays & Sundays 11-17 packed',
    poiTags: ['shopping', 'design', 'dining', 'west-berkeley']
  },
  {
    id: 'zone-marina-pier',
    name: 'Berkeley Marina Shoreline Lot',
    kind: 'lot',
    center: { lat: 37.8645, lng: -122.3168 },
    polygon: [],
    capacity: 310,
    pricePerHour: 0.0,
    walkTo: [{ label: 'Fishing Pier', minutes: 2 }, { label: 'César Chávez Park', minutes: 5 }],
    peakHours: 'Sunny weekends 13-18 busy, ample mornings',
    poiTags: ['waterfront', 'park', 'recreation', 'free']
  },
  {
    id: 'zone-san-pablo-avenue',
    name: 'San Pablo Commercial Strip',
    kind: 'street',
    center: { lat: 37.8665, lng: -122.2915 },
    polygon: [],
    capacity: 120,
    pricePerHour: 1.75,
    walkTo: [{ label: 'Supermarkets', minutes: 2 }, { label: 'Service Shops', minutes: 3 }],
    peakHours: 'Weekdays 15-19 steady',
    poiTags: ['commercial', 'street']
  },
  {
    id: 'zone-aquatic-park',
    name: 'Aquatic Park Westside Bay',
    kind: 'lot',
    center: { lat: 37.8592, lng: -122.2985 },
    polygon: [],
    capacity: 110,
    pricePerHour: 0.0,
    walkTo: [{ label: 'Water Trail', minutes: 1 }, { label: 'Disc Golf Course', minutes: 3 }],
    peakHours: 'Weekend afternoons 14-17 busy',
    poiTags: ['park', 'outdoor', 'free']
  }
];

module.exports = { seedZones };
