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

module.exports = {
  Zone: mongoose.models.Zone || mongoose.model('Zone', zoneSchema),
  ParkingEvent: mongoose.models.ParkingEvent || mongoose.model('ParkingEvent', parkingEventSchema),
  UserReport: mongoose.models.UserReport || mongoose.model('UserReport', userReportSchema),
  Prediction: mongoose.models.Prediction || mongoose.model('Prediction', predictionSchema),
  User: mongoose.models.User || mongoose.model('User', userSchema)
};
