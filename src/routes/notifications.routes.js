const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notification.controller');

router.get('/', NotificationController.getNotifications);
router.get('/:notificationId/action', NotificationController.getNotificationAction);
router.put('/:notificationId/read', NotificationController.markAsRead);
router.put('/read-all', NotificationController.markAllAsRead);
router.get('/count/unread', NotificationController.getUnreadCount);

module.exports = router;
