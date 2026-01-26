const User = require('../models/User');
const cloudinary = require('../config/cloudinary.config');

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, bio, username, isVerified = false } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({
        username,
        _id: { $ne: userId },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken',
        });
      }
    }

    let avatarUrl = user.avatar;
    if (req.file) {
      try {
        if (user.avatar && user.avatar.includes('cloudinary')) {
          const publicId = user.avatar.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`avatars/${publicId}`);
        }

        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'avatars',
          width: 300,
          height: 300,
          crop: 'fill',
          gravity: 'face',
          quality: 'auto',
          format: 'webp',
        });

        avatarUrl = result.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading avatar',
        });
      }
    }

    const verifiedStatus =
      typeof isVerified === 'string' ? isVerified === 'true' : Boolean(isVerified);

    const updateData = {
      ...(name && { name }),
      ...(bio !== undefined && { bio }),
      ...(username && { username }),
      ...(isVerified !== undefined && { isVerified: verifiedStatus }),
      ...(avatarUrl !== user.avatar && { avatar: avatarUrl }),
    };

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select('-passwordHash -resetToken -resetTokenExpiry');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors,
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while updating profile',
    });
  }
};

exports.deleteAvatar = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.avatar && user.avatar.includes('cloudinary')) {
      try {
        const publicId = user.avatar.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`avatars/${publicId}`);
      } catch (cloudinaryError) {
        console.error('Cloudinary delete error:', cloudinaryError);
      }
    }

    user.avatar = '';
    await user.save();

    const updatedUser = await User.findById(userId).select(
      '-passwordHash -resetToken -resetTokenExpiry'
    );

    res.json({
      success: true,
      message: 'Avatar removed successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing avatar',
    });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { theme, sidebar, accountStatus } = req.body;

    if (!theme && !sidebar && !accountStatus) {
      return res.status(400).json({
        success: false,
        message: 'No settings provided to update',
      });
    }

    const validThemes = ['light', 'dark'];
    const validSidebar = ['expanded', 'collapsed'];
    const validAccountStatus = ['public', 'private'];

    const updateData = {};
    if (theme && validThemes.includes(theme)) updateData['settings.theme'] = theme;
    if (sidebar && validSidebar.includes(sidebar)) updateData['settings.sidebar'] = sidebar;
    if (accountStatus && validAccountStatus.includes(accountStatus))
      updateData.accountStatus = accountStatus;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      {
        new: true,
        select: 'settings accountStatus username name avatar',
      }
    );

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      settings: updatedUser.settings,
      accountStatus: updatedUser.accountStatus,
      user: {
        username: updatedUser.username,
        name: updatedUser.name,
        avatar: updatedUser.avatar,
      },
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating settings',
    });
  }
};
