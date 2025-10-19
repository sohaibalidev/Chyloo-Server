const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * Root Router
 *
 * Structure:
 * - /api/auth → Public authentication routes
 * - /api/*   → Protected API modules (require login)
 */

/* Attach User */
router.use(authMiddleware.attachUser);

// router.use((req, res, next) => {
//   console.log(req.user);
//   next();
// });

const checkHealth = (_, res) => {
  res.status(200).json({ status: 'ok' });
};

/* Public routes */
router.use('/auth', require('./auth.routes'));
router.get('/health', checkHealth);

/* Protected routes */
const protectedRoutes = express.Router();
protectedRoutes.use('/users', require('./users.routes'));
protectedRoutes.use('/settings', require('./settings.routes'));
protectedRoutes.use('/notifications', require('./notifications.routes'));
protectedRoutes.use('/messages', require('./messages.routes'));
protectedRoutes.use('/posts', require('./posts.routes'));
protectedRoutes.use('/feed', require('./feed.routes'));
protectedRoutes.use('/stories', require('./stories.routes'));
protectedRoutes.use('/search', require('./search.routes'));

router.use(authMiddleware.isAuthenticated, protectedRoutes);

module.exports = router;
