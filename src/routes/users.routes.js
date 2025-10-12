const express = require('express');
const router = express.Router();
const userController = require('../controllers/users.controller');

router.get('/me', userController.getMe);

router.get('/:username', userController.getUserById);

router.post('/:id/follow', userController.followUser);
router.delete('/:id/follow', userController.unfollowUser);

module.exports = router;
