const express = require('express');
const router = express.Router();
const userController = require('../controllers/users.controller');
const upload = require('../config/multer.config');

router.get('/me', userController.getMe);

router.get('/:username', userController.getUserByUsername);

router.post('/:id/follow', userController.followUser);
router.delete('/:id/follow', userController.unfollowUser);

router.put('/profile', upload.single('avatar'), userController.updateProfile);

router.delete('/avatar', userController.deleteAvatar);

module.exports = router;
