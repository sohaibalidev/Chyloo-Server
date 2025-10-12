const mongoose = require('mongoose');

const storySchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    media: {
      url: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: ['image', 'video'],
        required: true,
      },
      duration: {
        type: Number,
        default: 7,
      },
    },
    caption: {
      type: String,
      maxlength: 150,
      default: '',
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expires: 0 }, 
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

storySchema.index({ authorId: 1, createdAt: -1 });

storySchema.statics.getActiveStoriesByUserId = function (userId) {
  return this.find({
    authorId: userId,
    expiresAt: { $gt: new Date() },
    isActive: true,
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Story', storySchema);
