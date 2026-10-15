const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({ lat: Number, lng: Number }, { _id: false });

const zoneSchema = new mongoose.Schema({
  zoneId: { type: String, unique: true },
  name: String,
  kind: { type: String, enum: ['street', 'lot', 'cluster'] },
  center: pointSchema,
  polygon: [[Number]],
  capacity: Number,
  pricePerHour: Number,
  walkTo: [{ label: String, minutes: Number }],
  peakHours: String,
  poiTags: [String]
}, { collection: 'zones', timestamps: true });

const parkingEventSchema = new mongoose.Schema({
  zoneId: String,
  observedAt: Date,
  occupancyLevel: Number, // 0..1 inferred
  source: { type: String, enum: ['open-data', 'proxy', 'inferred', 'crowd'] }
}, { collection: 'parking_events', timestamps: true });

const userReportSchema = new mongoose.Schema({
  zoneId: String,
  signal: { type: String, enum: ['found', 'full', 'circling'] },
  note: String,
  createdAt: { type: Date, default: Date.now }
}, { collection: 'user_reports', timestamps: true });

const predictionSchema = new mongoose.Schema({
  zoneId: String,
  time: Date,
  horizonMin: Number,
  probability: Number,
  confidence: Number,
  modelVersion: String
}, { collection: 'predictions', timestamps: true });

const userSchema = new mongoose.Schema({
  displayName: String,
  points: { type: Number, default: 0 },
  badges: [String],
  preferences: mongoose.Schema.Types.Mixed
}, { collection: 'users', timestamps: true });

// 7-Day Rolling Parking Feed Schema
const parkingFeedSchema = new mongoose.Schema({
  zoneId: { type: String, required: true, index: true },
  zoneName: { type: String, required: true },
  timestamp: { type: Date, required: true },
  dateStr: { type: String, required: true, index: true }, // 'YYYY-MM-DD'
  dayOfWeek: { type: String, required: true },
  occupancyRate: { type: Number, required: true, min: 0, max: 1 },
  probability: { type: Number, required: true, min: 0, max: 1 },
  availableSpots: { type: Number, required: true, min: 0 },
  totalCapacity: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['high', 'medium', 'low'], required: true },
  peakHour: { type: String, default: '17:00-19:00' },
  turnoverCount: { type: Number, default: 0 },
  weather: { type: String, default: 'Clear' },
  summary: { type: String },
  source: { type: String, default: 'daily-feed-sync' }
}, { collection: 'parking_feed', timestamps: true });

// Compound index for zone timelines
parkingFeedSchema.index({ zoneId: 1, timestamp: -1 });

// MongoDB TTL Index: automatically purges documents older than 7 days (604800 seconds)
parkingFeedSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = {
  Zone: mongoose.models.Zone || mongoose.model('Zone', zoneSchema),
  ParkingEvent: mongoose.models.ParkingEvent || mongoose.model('ParkingEvent', parkingEventSchema),
  UserReport: mongoose.models.UserReport || mongoose.model('UserReport', userReportSchema),
  Prediction: mongoose.models.Prediction || mongoose.model('Prediction', predictionSchema),
  User: mongoose.models.User || mongoose.model('User', userSchema),
  ParkingFeed: mongoose.models.ParkingFeed || mongoose.model('ParkingFeed', parkingFeedSchema)
};
