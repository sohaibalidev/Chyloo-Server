const { Follow, Post, Session } = require('../models');
const enhancePosts = require('../helpers/post-enhancer');

exports.getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const userSessions = await Session.find({ userId: req.user._id, isActive: true }).sort({
      createdAt: -1,
    });
    let daysLimit = 5;
    if (userSessions.length > 0) {
      const mostRecentLogin = userSessions[0].createdAt;
      const daysSinceLogin = Math.floor((new Date() - mostRecentLogin) / (1000 * 60 * 60 * 24));
      daysLimit = Math.max(5, daysSinceLogin);
    }

    const followingDocs = await Follow.find({ followerId: req.user._id }).select('followingId');
    const followingIds = followingDocs.map((f) => f.followingId);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysLimit);

    const query = {
      createdAt: { $gte: sinceDate },
      $or: [
        { authorId: { $in: followingIds }, visibility: { $in: ['public', 'followers'] } },
        { authorId: req.user._id },
      ],
    };

    const posts = await Post.find(query)
      .populate('authorId', 'username name avatar isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const enhancedPosts = await enhancePosts(posts, req.user);

    const total = await Post.countDocuments(query);
    const hasMore = skip + enhancedPosts.length < total;

    res.json({
      success: true,
      posts: enhancedPosts,
      feedDaysLimit: daysLimit,
      pagination: { current: page, hasMore, total },
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: 'Error fetching following feed',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

exports.getInfiniteFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { visibility: 'public' };

    const posts = await Post.find(query)
      .populate('authorId', 'username name avatar isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const enhancedPosts = await enhancePosts(posts, req.user);

    const total = await Post.countDocuments(query);
    const hasMore = skip + enhancedPosts.length < total;

    res.json({
      success: true,
      posts: enhancedPosts,
      pagination: { current: page, hasMore, total },
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      success: false,
      message: 'Error fetching explore feed',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};
