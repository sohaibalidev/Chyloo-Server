const { Comment, Like, User } = require('../models/');

/**
 * Enhances posts with user engagement data and additional metrics
 * @param {Array|Object} posts - Post(s) to enhance
 * @param {Object} user - Current user object (optional)
 * @returns {Promise<Array|Object>} Enhanced post(s) with engagement flags
 */
module.exports = async function enhancePosts(posts, user = null) {
  try {
    const isSingle = !Array.isArray(posts);
    const postsArray = isSingle ? [posts] : posts;

    if (postsArray.length === 0) {
      return isSingle ? null : [];
    }

    const postIds = postsArray.map((post) => post._id);

    const [commentCounts, likeCounts, userLikes, currentUser, recentComments] = await Promise.all([
      Comment.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: '$targetId', count: { $sum: 1 } } },
      ]),

      Like.aggregate([
        { $match: { targetId: { $in: postIds } } },
        { $group: { _id: '$targetId', count: { $sum: 1 } } },
      ]),

      user
        ? Like.find({
            targetId: { $in: postIds },
            userId: user._id,
            type: 'post',
          }).select('targetId')
        : Promise.resolve([]),

      user ? User.findById(user._id).select('savedPosts') : Promise.resolve({ savedPosts: [] }),

      Comment.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$postId',
            comments: { $push: '$$ROOT' },
          },
        },
        { $project: { comments: { $slice: ['$comments', 2] } } },
      ]),
    ]);

    const commentCountsMap = new Map();
    commentCounts.forEach((item) => commentCountsMap.set(item._id.toString(), item.count));

    const likeCountsMap = new Map();
    likeCounts.forEach((item) => likeCountsMap.set(item._id.toString(), item.count));

    const likedPostIds = new Set(userLikes.map((like) => like.targetId.toString()));
    const savedPostIds = new Set(currentUser.savedPosts.map((id) => id.toString()));

    const recentCommentsMap = new Map();
    recentComments.forEach((item) =>
      recentCommentsMap.set(item._id.toString(), item.comments || [])
    );

    const allComments = recentComments.flatMap((item) => item.comments || []);
    if (allComments.length > 0) {
      await Comment.populate(allComments, {
        path: 'authorId',
        select: 'username',
      });
    }

    const enhancedPosts = postsArray.map((post) => {
      const postIdStr = post._id.toString();
      const obj = post.toObject ? post.toObject() : post;

      obj.user = obj.authorId;
      delete obj.authorId;

      obj.commentsCount = commentCountsMap.get(postIdStr) || 0;
      obj.likesCount = likeCountsMap.get(postIdStr) || 0;

      const postComments = recentCommentsMap.get(postIdStr) || [];
      obj.comments = postComments.map((comment) => ({
        _id: comment._id,
        text: comment.text,
        user: {
          _id: comment.authorId._id,
          username: comment.authorId.username,
        },
      }));

      if (user) {
        obj.isLiked = likedPostIds.has(postIdStr);
        obj.isSaved = savedPostIds.has(postIdStr);
      } else {
        obj.isLiked = false;
        obj.isSaved = false;
      }

      return obj;
    });

    return isSingle ? enhancedPosts[0] : enhancedPosts;
  } catch (error) {
    console.error('Error enhancing posts:', error);
    throw error;
  }
};
