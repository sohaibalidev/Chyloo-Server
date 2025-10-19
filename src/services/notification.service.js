const {Notification, User, Post, Comment, Follow} = require('../models/');

class NotificationService {
  // Create like notification
  static async createLikeNotification(userId, targetId, type) {
    try {
      let target, message, targetType;

      if (type === 'post') {
        target = await Post.findById(targetId).populate('authorId');
        targetType = 'Post';
        message = `${target.authorId.username} liked your post`;
      } else if (type === 'comment') {
        target = await Comment.findById(targetId).populate('authorId');
        targetType = 'Comment';
        message = `${target.authorId.username} liked your comment`;
      }

      if (!target || target.authorId._id.toString() === userId.toString()) {
        return; // Don't notify if user likes their own content
      }

      const notification = await Notification.createNotification({
        recipientId: target.authorId._id,
        senderId: userId,
        type: type === 'post' ? 'like_post' : 'like_comment',
        targetId,
        targetType,
        message,
        metadata: {
          postId: type === 'post' ? targetId : target.postId,
          commentId: type === 'comment' ? targetId : null,
        },
      });

      return notification;
    } catch (error) {
      console.error('Error creating like notification:', error);
      throw error;
    }
  }

  // Create comment notification
  static async createCommentNotification(userId, postId, commentId) {
    try {
      const post = await Post.findById(postId).populate('authorId');
      const comment = await Comment.findById(commentId).populate('authorId');

      if (!post || post.authorId._id.toString() === userId.toString()) {
        return; // Don't notify if user comments on their own post
      }

      const notification = await Notification.createNotification({
        recipientId: post.authorId._id,
        senderId: userId,
        type: 'comment',
        targetId: commentId,
        targetType: 'Comment',
        message: `${comment.authorId.username} commented on your post`,
        metadata: {
          postId,
          commentId,
        },
      });

      return notification;
    } catch (error) {
      console.error('Error creating comment notification:', error);
      throw error;
    }
  }

  // Create follow notification
  static async createFollowNotification(followerId, followingId) {
    try {
      const follower = await User.findById(followerId);
      const following = await User.findById(followingId);

      if (!follower || !following) {
        throw new Error('User not found');
      }

      // Check if the following user has private account
      const notificationType = following.accountStatus === 'private' ? 'follow_request' : 'follow';

      const notification = await Notification.createNotification({
        recipientId: followingId,
        senderId: followerId,
        type: notificationType,
        targetId: followerId,
        targetType: 'User',
        message:
          notificationType === 'follow_request'
            ? `${follower.username} requested to follow you`
            : `${follower.username} started following you`,
        metadata: {
          isPrivateAccount: following.accountStatus === 'private',
        },
      });

      return notification;
    } catch (error) {
      console.error('Error creating follow notification:', error);
      throw error;
    }
  }

  // Create follow accept notification
  static async createFollowAcceptNotification(followingId, followerId) {
    try {
      const following = await User.findById(followingId);
      const follower = await User.findById(followerId);

      const notification = await Notification.createNotification({
        recipientId: followerId,
        senderId: followingId,
        type: 'follow_accept',
        targetId: followingId,
        targetType: 'User',
        message: `${following.username} accepted your follow request`,
      });

      return notification;
    } catch (error) {
      console.error('Error creating follow accept notification:', error);
      throw error;
    }
  }

  // Get user notifications
  static async getUserNotifications(userId, page = 1, limit = 20) {
    try {
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
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipientId: userId,
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      return await notification.markAsRead();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId) {
    try {
      await Notification.updateMany(
        { recipientId: userId, isRead: false },
        { $set: { isRead: true } }
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Get notification action URL
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
      case 'follow_request':
      case 'follow_accept':
        return `${baseUrls.user}/${notification.senderId.username}`;

      default:
        return '/';
    }
  }
}

module.exports = NotificationService;
