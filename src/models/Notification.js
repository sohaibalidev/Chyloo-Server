const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['like_post', 'like_comment', 'comment', 'follow', 'follow_accept', 'follow_request'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'targetType',
    },
    targetType: {
      type: String,
      enum: ['Post', 'Comment', 'User'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ senderId: 1, type: 1, targetId: 1 });

notificationSchema.statics.createNotification = async function (notificationData) {
  const notification = new this(notificationData);
  await notification.save();
  return notification;
};

notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
