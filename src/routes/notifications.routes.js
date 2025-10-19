const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notification.controller');

// Get notifications
router.get('/', NotificationController.getNotifications);

// Get notification action
router.get('/:notificationId/action', NotificationController.getNotificationAction);

// Mark notification as read
router.put('/:notificationId/read', NotificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', NotificationController.markAllAsRead);

// Get unread count
router.get('/count/unread', NotificationController.getUnreadCount);

module.exports = router;
