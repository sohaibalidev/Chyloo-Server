const express = require('express');
const router = express.Router();
const upload = require('../config/multer.config');
const messageController = require('../controllers/messages.controller');

// Conversation routes
router.get('/conversations', messageController.getConversations);
router.get('/conversation/:userId', messageController.getOrCreateConversation);
router.post('/group', upload.single('groupIcon'), messageController.createGroupConversation);

// Message routes
router.get('/:chatId', messageController.getMessages);
router.post('/', upload.array('media', 10), messageController.sendMessage);
router.post('/:messageId/seen', messageController.markAsSeen);
router.delete('/:messageId', messageController.deleteMessage);

module.exports = router;
