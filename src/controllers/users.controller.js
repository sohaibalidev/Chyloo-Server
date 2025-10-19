const { Follow, User } = require('../models/');
const cloudinary = require('../config/cloudinary.config');

exports.getMe = async (req, res) => {
  try {
    const { _id, username, name, bio, avatar, isVerified, settings, accountStatus } = req.user;

    const following = await Follow.find({ followerId: _id }).select('-__v');
    const followingUsers = await Promise.all(
      following.map((follow) =>
        User.findById(follow.followingId).select('_id username name avatar isVerified ')
      )
    );

    res.json({
      success: true,
      user: {
        _id,
        username,
        name,
        bio,
        avatar,
        isVerified,
        settings,
        accountStatus,
        following: followingUsers,
      },
    });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error fetching user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.getUserByUsername = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required',
      });
    }

    const user = await User.findOne({ username }).select(
      '-passwordHash -resetToken -resetTokenExpiry -email -__v'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isMe = req.user && req.user._id.toString() === user._id.toString();

    let isFollowed = false;
    if (!isMe && req.user && req.user._id) {
      const followDoc = await Follow.findOne({
        followerId: req.user._id,
        followingId: user._id,
      });
      isFollowed = !!followDoc;
    }

    const [followerCount, followingCount] = await Promise.all([
      Follow.countDocuments({ followingId: user._id }),
      Follow.countDocuments({ followerId: user._id }),
    ]);

    const userObj = user.toObject();

    userObj.followerCount = followerCount;
    userObj.followingCount = followingCount;
    userObj.isFollowed = isFollowed;
    userObj.isMe = isMe;

    if (!isMe) {
      delete userObj.savedPosts;
    }

    res.status(200).json({
      success: true,
      user: userObj,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user data',
    });
  }
};

exports.followUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You can't follow yourself" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const follow = await Follow.findOneAndUpdate(
      { followerId: req.user._id, followingId: targetUserId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    if (follow) {
      const NotificationController = require('./notification.controller');
      await NotificationController.createFollowNotification(req.user._id, targetUserId);
    }

    res.status(200).json({ success: true, message: 'User followed successfully', follow });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: 'Error following user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;

    const unfollow = await Follow.findOneAndDelete({
      followerId: req.user._id,
      followingId: targetUserId,
    });

    if (!unfollow) {
      return res.status(400).json({ success: false, message: 'You are not following this user' });
    }

    res.status(200).json({ success: true, message: 'User unfollowed successfully' });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: 'Error unfollowing user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};
