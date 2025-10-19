const express = require('express');
const router = express.Router();
const {
  updateProfile,
  deleteAvatar,
  updateSettings,
} = require('../controllers/settings.controller');
const upload = require('../config/multer.config');

router.put('/profile', upload.single('avatar'), updateProfile);
router.delete('/avatar', deleteAvatar);
router.put('/preferences', updateSettings);

module.exports = router;
