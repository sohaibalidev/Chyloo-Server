const { Notification, User, Post, Comment, Follow } = require('../models/');

class NotificationService {
  static async createLikeNotification(userId, targetId, type) {
    let target, message, targetType;

    if (type === 'post') {
      target = await Post.findById(targetId).populate('authorId');
      targetType = 'Post';
      message = 'liked your post';
    } else if (type === 'comment') {
      target = await Comment.findById(targetId).populate('authorId');
      targetType = 'Comment';
      message = 'liked your comment';
    }

    if (!target || target.authorId._id.toString() === userId.toString()) {
      return;
    }

    const sender = await User.findById(userId);
    const fullMessage = `@${sender.username} ${message}`;

    const existingNotification = await Notification.findOne({
      recipientId: target.authorId._id,
      senderId: userId,
      type: type === 'post' ? 'like_post' : 'like_comment',
      targetId,
    });

    if (existingNotification) return existingNotification;

    const notification = await Notification.createNotification({
      recipientId: target.authorId._id,
      senderId: userId,
      type: type === 'post' ? 'like_post' : 'like_comment',
      targetId,
      targetType,
      message: fullMessage,
      metadata: {
        postId: type === 'post' ? targetId : target.postId,
        commentId: type === 'comment' ? targetId : null,
      },
    });

    await this.emitNotification(notification);
    return notification;
  }

  static async createCommentNotification(userId, postId, commentId) {
    const post = await Post.findById(postId).populate('authorId');

    if (!post || post.authorId._id.toString() === userId.toString()) return;

    const sender = await User.findById(userId);
    const message = `@${sender.username} commented on your post`;

    const notification = await Notification.createNotification({
      recipientId: post.authorId._id,
      senderId: userId,
      type: 'comment',
      targetId: commentId,
      targetType: 'Comment',
      message,
      metadata: { postId, commentId },
    });

    await this.emitNotification(notification);
    return notification;
  }

  static async createFollowRequestNotification(followerId, followingId) {
    const follower = await User.findById(followerId);
    const following = await User.findById(followingId);

    if (!follower || !following) throw new Error('User not found');

    const message = `@${follower.username} requested to follow you`;

    const notification = await Notification.createNotification({
      recipientId: followingId,
      senderId: followerId,
      type: 'follow_request',
      targetId: followerId,
      targetType: 'User',
      message,
      metadata: { followRequest: true },
    });

    await this.emitNotification(notification);
    return notification;
  }

  static async createFollowNotification(followerId, followingId) {
    const follower = await User.findById(followerId);
    const following = await User.findById(followingId);

    if (!follower || !following) throw new Error('User not found');

    if (following.accountStatus === 'private') return null;

    const message = `@${follower.username} started following you`;

    const existingNotification = await Notification.findOne({
      recipientId: followingId,
      senderId: followerId,
      type: 'follow',
      targetId: followerId,
    });

    if (existingNotification) return existingNotification;

    const notification = await Notification.createNotification({
      recipientId: followingId,
      senderId: followerId,
      type: 'follow',
      targetId: followerId,
      targetType: 'User',
      message,
    });

    await this.emitNotification(notification);
    return notification;
  }

  static async createFollowAcceptNotification(followingId, followerId) {
    const following = await User.findById(followingId);
    const follower = await User.findById(followerId);

    if (!following || !follower) throw new Error('User not found');

    const message = `@${following.username} accepted your follow request`;

    const notification = await Notification.createNotification({
      recipientId: followerId,
      senderId: followingId,
      type: 'follow_accept',
      targetId: followingId,
      targetType: 'User',
      message,
    });

    await this.emitNotification(notification);
    return notification;
  }

  static async getUserNotifications(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipientId: userId })
      .populate('senderId', 'username avatar name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments({ recipientId: userId });
    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      isRead: false,
    });

    return {
      notifications,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        unreadCount,
      },
    };
  }

  static async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      recipientId: userId,
    });

    if (!notification) throw new Error('Notification not found');
    return await notification.markAsRead();
  }

  static async markAllAsRead(userId) {
    await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { $set: { isRead: true } }
    );
  }

  static getNotificationAction(notification) {
    const baseUrls = {
      post: '/post',
      comment: '/post',
      user: '/profile',
    };

    switch (notification.type) {
      case 'like_post':
        return `${baseUrls.post}/${notification.metadata?.postId || notification.targetId}`;
      case 'like_comment':
      case 'comment':
        return `${baseUrls.comment}/${notification.metadata?.postId}?comment=${notification.targetId}`;
      case 'follow':
      case 'follow_accept':
      case 'follow_request':
        return `${baseUrls.user}/${notification.senderId.username}`;
      default:
        return '/';
    }
  }

  static async emitNotification(notification) {
    const populatedNotification = await Notification.findById(notification._id)
      .populate('senderId', 'username avatar')
      .lean();

    if (global._io) {
      global._io
        .to(`user_${notification.recipientId.toString()}`)
        .emit('new_notification', populatedNotification);
    }
  }
}

module.exports = NotificationService;
