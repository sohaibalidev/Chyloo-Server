const express = require('express');
const router = express.Router();
const userController = require('../controllers/users.controller');

router.get('/me', userController.getMe);

router.get('/requests', userController.getFollowRequests);
router.post('/:followerId/accept', userController.acceptFollowRequest);
router.post('/:followerId/reject', userController.rejectFollowRequest);

router.post('/:id/follow', userController.followUser);
router.delete('/:id/unfollow', userController.unfollowUser);

router.get('/:username', userController.getUserByUsername);

module.exports = router;
