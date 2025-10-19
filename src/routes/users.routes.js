const express = require('express');
const router = express.Router();
const userController = require('../controllers/users.controller');
const upload = require('../config/multer.config');

router.get('/me', userController.getMe);

router.get('/:username', userController.getUserByUsername);

router.post('/:id/follow', userController.followUser);
router.delete('/:id/follow', userController.unfollowUser);

module.exports = router;
