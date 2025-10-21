const { Follow, User, Notification } = require('../models/');
const NotificationService = require('../services/notification.service');

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

    // Remove follow notification for the target user
    await Notification.deleteMany({
      senderId: req.user._id,
      recipientId: targetUserId,
      type: 'follow',
      targetId: req.user._id,
    });

    // Remove follow request notification if it exists
    await Notification.deleteMany({
      senderId: req.user._id,
      recipientId: targetUserId,
      type: 'follow_request',
      targetId: req.user._id,
    });

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

    const existingFollow = await Follow.findOne({
      followerId: req.user._id,
      followingId: targetUserId,
    });

    if (existingFollow) {
      if (existingFollow.status === 'pending') {
        return res.status(400).json({ success: false, message: 'Follow request already sent' });
      }
      if (existingFollow.status === 'accepted') {
        return res.status(400).json({ success: false, message: 'Already following this user' });
      }
    }

    const follow = new Follow({
      followerId: req.user._id,
      followingId: targetUserId,
    });

    await follow.save();

    let message = 'User followed successfully';

    if (targetUser.accountStatus === 'private') {
      await NotificationService.createFollowRequestNotification(req.user._id, targetUserId);
      message = 'Follow request sent';
    } else {
      await NotificationService.createFollowNotification(req.user._id, targetUserId);
    }

    res.status(200).json({
      success: true,
      message,
      follow,
      isPrivateAccount: targetUser.accountStatus === 'private',
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: 'Error following user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

exports.acceptFollowRequest = async (req, res) => {
  try {
    const { followerId } = req.params;
    const userId = req.user._id;

    const followRequest = await Follow.findOne({
      followerId: followerId,
      followingId: userId,
      status: 'pending',
    });

    if (!followRequest) {
      return res.status(404).json({ success: false, message: 'Follow request not found' });
    }

    followRequest.status = 'accepted';
    await followRequest.save();

    // Remove the follow request notification
    await Notification.deleteMany({
      senderId: followerId,
      recipientId: userId,
      type: 'follow_request',
      targetId: followerId,
    });

    await NotificationService.createFollowAcceptNotification(userId, followerId);

    res.status(200).json({
      success: true,
      message: 'Follow request accepted',
    });
  } catch (error) {
    console.error('Error accepting follow request:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting follow request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.rejectFollowRequest = async (req, res) => {
  try {
    const { followerId } = req.params;
    const userId = req.user._id;

    const followRequest = await Follow.findOneAndDelete({
      followerId: followerId,
      followingId: userId,
      status: 'pending',
    });

    if (!followRequest) {
      return res.status(404).json({ success: false, message: 'Follow request not found' });
    }

    // Remove the follow request notification
    await Notification.deleteMany({
      senderId: followerId,
      recipientId: userId,
      type: 'follow_request',
      targetId: followerId,
    });

    res.status(200).json({
      success: true,
      message: 'Follow request rejected',
    });
  } catch (error) {
    console.error('Error rejecting follow request:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting follow request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.getFollowRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const followRequests = await Follow.find({
      followingId: userId,
      status: 'pending',
    })
      .populate('followerId', 'username name avatar isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Follow.countDocuments({
      followingId: userId,
      status: 'pending',
    });

    res.status(200).json({
      success: true,
      data: followRequests,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Error fetching follow requests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching follow requests',
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
      '-passwordHash -resetToken -resetTokenExpiry -email -__v -settings -updatedAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isMe = req.user && req.user._id.toString() === user._id.toString();

    let followStatus = 'not_following';
    if (!isMe && req.user && req.user._id) {
      const followDoc = await Follow.findOne({
        followerId: req.user._id,
        followingId: user._id,
      });
      if (followDoc) {
        followStatus = followDoc.status;
      }
    }

    const [followerCount, followingCount] = await Promise.all([
      Follow.countDocuments({ followingId: user._id, status: 'accepted' }),
      Follow.countDocuments({ followerId: user._id, status: 'accepted' }),
    ]);

    const userObj = user.toObject();

    userObj.followerCount = followerCount;
    userObj.followingCount = followingCount;
    userObj.followStatus = followStatus;
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
