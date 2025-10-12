const mongoose = require('mongoose');

const userAgentSchema = new mongoose.Schema(
  {
    os: { type: String },
    browser: { type: String },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    socketId: { type: String, required: true },
    userAgent: { type: userAgentSchema },
    isActive: { type: Boolean, default: true },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

sessionSchema.index({ userId: 1 });
sessionSchema.index({ socketId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

sessionSchema.statics.findBySocketId = function (socketId) {
  return this.findOne({ socketId, isActive: true });
};

sessionSchema.statics.findBySessionId = function (sessionId) {
  return this.findOne({ sessionId, isActive: true });
};

sessionSchema.statics.findActiveByUserId = function (userId) {
  return this.find({ userId, isActive: true, expiresAt: { $gt: new Date() } });
};

sessionSchema.methods.deactivate = function () {
  this.isActive = false;
  this.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  return this.save();
};

sessionSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

module.exports = mongoose.model('Session', sessionSchema);
