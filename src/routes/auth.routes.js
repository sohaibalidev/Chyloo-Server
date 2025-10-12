const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { validateLogin, validateRegister } = require('../validators/auth.validation');

// Guest routes (only for non-authenticated users)
router.post('/register', authMiddleware.isGuest, validateRegister, authController.register);
router.post('/login', authMiddleware.isGuest, validateLogin, authController.login);

router.post('/forgot-password', authMiddleware.isGuest, authController.forgotPassword);
router.post('/reset-password/:token', authMiddleware.isGuest, authController.resetPassword);

// Authenticated routes
router.post('/logout', authMiddleware.isAuthenticated, authController.logout);

module.exports = router;
