const NotificationService = require('../services/notification.service');
const { Notification } = require('../models/');

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const result = await NotificationService.getUserNotifications(
      userId,
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message,
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await NotificationService.markAsRead(notificationId, userId);

    res.json({
      success: true,
      data: notification,
      message: 'Notification marked as read',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: error.message,
    });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await NotificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking all notifications as read',
      error: error.message,
    });
  }
};

exports.getNotificationAction = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOne({
      _id: notificationId,
      recipientId: userId,
    }).populate('senderId', 'username');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    await NotificationService.markAsRead(notificationId, userId);

    const actionUrl = NotificationService.getNotificationAction(notification);

    res.json({
      success: true,
      data: {
        actionUrl,
        notification,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting notification action',
      error: error.message,
    });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      isRead: false,
    });

    res.json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error getting unread count',
      error: error.message,
    });
  }
};

exports.createFollowNotification = async (senderId, recipientId) => {
  try {
    const Notification = require('../models/Notification');
    const User = require('../models/User');

    const sender = await User.findById(senderId).select('username avatar');
    const recipient = await User.findById(recipientId).select('username');

    if (!sender || !recipient) {
      throw new Error('Sender or recipient not found');
    }

    const notification = await Notification.createNotification({
      recipientId,
      senderId,
      type: 'follow',
      targetId: senderId, 
      targetType: 'User',
      message: `${sender.username} started following you`,
      metadata: {
        followAction: 'followed',
      },
    });

    const populatedNotification = await Notification.findById(notification._id)
      .populate('senderId', 'username avatar')
      .lean();

    if (global._io) {
      global._io
        .to(`user_${recipientId.toString()}`)
        .emit('new_notification', populatedNotification);
      console.log(`[SOCKET] Emitted new_notification to user_${recipientId.toString()}`);
    } else {
      console.log('[SOCKET] Socket.IO not available for notification');
    }

    return notification;
  } catch (error) {
    console.error('Error creating follow notification:', error);
    throw error;
  }
};
