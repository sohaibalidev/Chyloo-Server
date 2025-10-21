const mongoose = require('mongoose');
const { Follow, Post, User } = require('../models');
const enhancePosts = require('../utils/post-enhancer');

exports.getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const followingDocs = await Follow.find({
      followerId: req.user._id,
      status: 'accepted',
    }).select('followingId');
    const followingIds = followingDocs.map((f) => f.followingId.toString());

    let posts = await Post.find({})
      .populate('authorId', 'username name avatar isVerified accountStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    posts = posts.filter((post) => {
      const authorId = post.authorId._id.toString();
      const isOwnPost = authorId === req.user._id.toString();
      const isFollowing = followingIds.includes(authorId);

      if (isOwnPost) return true;

      if (isFollowing) {
        if (post.visibility === 'public') return true;
        if (post.visibility === 'followers') return true;
      }

      return false;
    });

    const enhancedPosts = await enhancePosts(posts, req.user);

    res.json({
      success: true,
      posts: enhancedPosts,
      pagination: { current: page, hasMore: posts.length === limit },
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

// exports.getInfiniteFeed = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     const followingDocs = await Follow.find({
//       followerId: req.user._id,
//       status: 'accepted',
//     }).select('followingId');
//     const followingIds = followingDocs.map((f) => f.followingId.toString());

//     let posts = await Post.find({ visibility: 'public' })
//       .populate('authorId', 'username name avatar isVerified accountStatus')
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit);

//     posts = posts.filter((post) => {
//       const authorId = post.authorId._id.toString();
//       const isOwnPost = authorId === req.user._id.toString();
//       const isFollowing = followingIds.includes(authorId);

//       if (isOwnPost) return false;

//       return !isFollowing;
//     });

//     const enhancedPosts = await enhancePosts(posts, req.user);

//     const total = await Post.countDocuments({
//       visibility: 'public',
//       authorId: { $nin: [...followingIds, req.user._id] },
//     });

//     const hasMore = skip + enhancedPosts.length < total;

//     res.json({
//       success: true,
//       posts: enhancedPosts,
//       pagination: { current: page, hasMore, total },
//     });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching explore feed',
//       error: process.env.NODE_ENV === 'development' ? err.message : undefined,
//     });
//   }
// };

exports.getInfiniteFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const followingDocs = await Follow.find({
      followerId: req.user._id,
      status: 'accepted',
    }).select('followingId');
    const followingIds = followingDocs.map((f) => f.followingId.toString());

    // Use aggregation to filter posts and users in one query
    const posts = await Post.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'authorId',
          foreignField: '_id',
          as: 'author',
        },
      },
      {
        $unwind: '$author',
      },
      {
        $match: {
          visibility: 'public',
          'author.accountStatus': 'public', // Exclude private accounts
          authorId: {
            $nin: [...followingIds.map((id) => new mongoose.Types.ObjectId(id)), req.user._id],
          },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
      {
        $project: {
          // Include all post fields you need
          content: 1,
          media: 1,
          likes: 1,
          comments: 1,
          createdAt: 1,
          updatedAt: 1,
          // Author fields
          'author.username': 1,
          'author.name': 1,
          'author.avatar': 1,
          'author.isVerified': 1,
          'author.accountStatus': 1,
        },
      },
    ]);

    const enhancedPosts = await enhancePosts(posts, req.user);

    const total = await Post.countDocuments({
      visibility: 'public',
      authorId: {
        $in: await User.find({ accountStatus: 'public' }).distinct('_id'),
        $nin: [...followingIds, req.user._id],
      },
    });

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
