const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/auth.middleware');
const { updateSettings } = require('../controllers/settings.controller');

router.patch('/', isAuthenticated, updateSettings);

module.exports = router;
