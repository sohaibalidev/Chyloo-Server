const mongoose = require('mongoose');

const followSchema = new mongoose.Schema(
  {
    followerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    followingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'accepted',
    },
  },
  {
    timestamps: true,
  }
);

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
followSchema.index({ followerId: 1 });
followSchema.index({ followingId: 1 });
followSchema.index({ followingId: 1, status: 1 });

followSchema.pre('save', function (next) {
  if (this.isNew) {
    const User = require('./User');
    User.findById(this.followingId)
      .then((user) => {
        if (user && user.accountStatus === 'private') {
          this.status = 'pending';
        }
        next();
      })
      .catch(next);
  } else {
    next();
  }
});

module.exports = mongoose.model('Follow', followSchema);
  