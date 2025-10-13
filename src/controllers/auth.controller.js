const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { User, Session } = require('../models');
const emailService = require('../services/email.service');
const UAParser = require('ua-parser-js');
const config = require('../config/app.config');

const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, name, bio, avatar } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email or username',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = new User({
      username,
      email,
      passwordHash,
      name,
      bio: bio || '',
      avatar: avatar || '',
    });

    await user.save();

    const { _id } = user;
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: { _id, username, email, name, bio: bio || '', avatar: avatar || '' },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      error: config.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    const sessionId = generateSessionId();

    const socketId = req.body.socketId || 'web-session';
    const uaString = req.get('User-Agent') || '';

    const parser = new UAParser(uaString);
    const ua = parser.getResult();

    const session = new Session({
      userId: user._id,
      sessionId,
      socketId,
      userAgent: {
        os: ua.os.name,
        browser: ua.browser.name,
      },
      expiresAt: new Date(Date.now() + config.MAX_AGE),
    });

    await session.save();

    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: config.MAX_AGE,
      path: '/',
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      sessionId,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        bio: user.bio,
        avatar: user.avatar,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      error: config.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const { sessionId } = req;

    const session = await Session.findOne({ sessionId, isActive: true });

    if (session) {
      await session.deactivate();
    }

    res.clearCookie('sessionId');

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      error: config.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { username } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      });
    }

    const { email } = user;

    const resetToken = crypto.randomBytes(32).toString('hex');

    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000;

    await user.save();

    const resetUrl = `${config.FRONTEND_URL}/reset-password/${resetToken}`;

    const html = `
      <a href="${resetUrl}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
    `;

    await emailService.send(email, 'Password Reset Request', html);

    res.status(200).json({
      success: true,
      message: 'If the email exists, a password reset link has been sent',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      error: config.NODE_ENV === 'development' ? error : undefined,
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    const saltRounds = 12;
    user.passwordHash = await bcrypt.hash(password, saltRounds);

    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;

    await user.save();

    await Session.updateMany({ userId: user._id, isActive: true }, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      error: config.NODE_ENV === 'development' ? error : undefined,
    });
  }
};
