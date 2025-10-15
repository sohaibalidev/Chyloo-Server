const config = require('../config/app.config');
const { Session } = require('../models');

exports.isGuest = async (req, res, next) => {
  try {
    const sessionId = req.cookies?.sessionId;

    if (!sessionId) return next();

    const session = await Session.findOne({
      sessionId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).populate({
      path: 'userId',
      select: '-passwordHash -resetToken -resetTokenExpiry -__v',
    });

    if (!session || session.isExpired()) {
      if (session && session.isExpired()) await session.deactivate();
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'You are already logged in',
    });
  } catch (error) {
    console.error('isGuest middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during guest check',
    });
  }
};

exports.isAuthenticated = async (req, res, next) => {
  try {
    const sessionId = req.cookies?.sessionId;

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required: No session ID provided',
      });
    }

    const session = await Session.findOne({
      sessionId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).populate({
      path: 'userId',
      select: '-passwordHash -resetToken -resetTokenExpiry -__v',
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session',
      });
    }

    if (session.isExpired()) {
      await session.deactivate();
      return res.status(401).json({
        success: false,
        message: 'Session expired',
      });
    }

    req.user = session.userId;
    req.sessionId = sessionId;

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
      error: config.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

exports.attachUser = async (req, res, next) => {
  try {
    const sessionId = req.cookies?.sessionId;

    req.user = null;
    req.sessionId = null;

    if (!sessionId) return next();

    const session = await Session.findOne({
      sessionId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).populate({
      path: 'userId',
      select: '-passwordHash -resetToken -resetTokenExpiry -__v',
    });

    if (!session) return next();

    if (session.isExpired()) {
      await session.deactivate();
      return next();
    }

    req.user = session.userId;
    req.sessionId = sessionId;

    next();
  } catch (error) {
    console.error('AttachUser middleware error:', error);
    next();
  }
};
