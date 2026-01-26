const { Comment, Post, User, Like } = require('../models/');
const NotificationService = require('../services/notification.service');

const checkPostAccess = async (post, userId) => {
  if (post.authorId._id.toString() === userId.toString()) {
    return true;
  }

  switch (post.visibility) {
    case 'public':
      return true;

    case 'private':
      return false;

    case 'followers':
      const Follow = require('../models/Follow');
      const follow = await Follow.findOne({
        followerId: userId,
        followingId: post.authorId._id,
        status: 'accepted',
      });
      return !!follow;

    default:
      return false;
  }
};

exports.createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required',
      });
    }

    if (text.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot exceed 1000 characters',
      });
    }

    const post = await Post.findById(postId).populate(
      'authorId',
      'username name avatar isVerified accountStatus'
    );
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const canAccess = await checkPostAccess(post, userId);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to comment on this post',
      });
    }

    const comment = new Comment({
      postId,
      authorId: userId,
      text: text.trim(),
    });

    await comment.save();

    await comment.populate('authorId', 'username name avatar isVerified');

    post.comments.push(comment._id);
    await post.save();

    await NotificationService.createCommentNotification(userId, postId, comment._id);

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment,
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating comment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.likeComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const post = await Post.findById(comment.postId).populate(
      'authorId',
      'username name avatar isVerified accountStatus'
    );
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const canAccess = await checkPostAccess(post, userId);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to interact with this comment',
      });
    }

    const existingLike = await Like.findOne({
      targetId: commentId,
      userId,
      type: 'comment',
    });

    if (existingLike) {
      await existingLike.deleteOne();

      res.status(200).json({
        success: true,
        isLiked: false,
        message: 'Comment unliked',
      });
    } else {
      await Like.create({
        targetId: commentId,
        userId,
        type: 'comment',
      });

      await NotificationService.createLikeNotification(userId, commentId, 'comment');

      res.status(200).json({
        success: true,
        isLiked: true,
        message: 'Comment liked',
      });
    }
  } catch (error) {
    console.error('Error liking comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error liking comment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.getCommentsByPostId = async (req, res) => {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (post.visibility === 'private') {
      if (post.authorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access comments on private post',
        });
      }
    }

    if (post.visibility === 'followers') {
      if (post.authorId.toString() !== req.user._id.toString()) {
        const isFollowing = await require('../models/Follow').findOne({
          followerId: req.user._id,
          followingId: post.authorId,
        });
        if (!isFollowing) {
          return res.status(403).json({
            success: false,
            message: 'Cannot access comments on followers-only post',
          });
        }
      }
    }

    const comments = await Comment.find({ postId })
      .populate('authorId', 'username name avatar isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ postId });

    const commentsWithLikes = await Promise.all(
      comments.map(async (comment) => {
        const likeCount = await Like.countDocuments({
          targetId: comment._id,
          type: 'comment',
        });

        const isLiked = await Like.exists({
          targetId: comment._id,
          type: 'comment',
          userId: req.user._id,
        });

        return {
          ...comment.toObject(),
          likeCount,
          isLiked: !!isLiked,
        };
      })
    );

    res.status(200).json({
      success: true,
      comments: commentsWithLikes,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasMore: skip + comments.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching comments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required',
      });
    }

    if (text.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot exceed 1000 characters',
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    if (comment.authorId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to edit this comment',
      });
    }

    comment.text = text.trim();
    comment.updatedAt = new Date();
    await comment.save();

    await comment.populate('authorId', 'username name avatar isVerified');

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      comment,
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating comment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const post = await Post.findById(comment.postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const isCommentAuthor = comment.authorId.toString() === userId.toString();
    const isPostAuthor = post.authorId.toString() === userId.toString();

    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this comment',
      });
    }

    await Comment.findByIdAndDelete(commentId);

    post.comments = post.comments.filter((id) => id.toString() !== commentId.toString());
    await post.save();

    await Like.deleteMany({
      targetId: commentId,
      type: 'comment',
    });

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting comment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.getCommentById = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId).populate(
      'authorId',
      'username name avatar isVerified'
    );

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const post = await Post.findById(comment.postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (post.visibility === 'private') {
      if (post.authorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Cannot access comment on private post',
        });
      }
    }

    if (post.visibility === 'followers') {
      if (post.authorId.toString() !== req.user._id.toString()) {
        const isFollowing = await require('../models/Follow').findOne({
          followerId: req.user._id,
          followingId: post.authorId,
        });
        if (!isFollowing) {
          return res.status(403).json({
            success: false,
            message: 'Cannot access comment on followers-only post',
          });
        }
      }
    }

    const likeCount = await Like.countDocuments({
      targetId: commentId,
      type: 'comment',
    });

    const isLiked = await Like.exists({
      targetId: commentId,
      type: 'comment',
      userId: req.user._id,
    });

    const commentWithLikes = {
      ...comment.toObject(),
      likeCount,
      isLiked: !!isLiked,
    };

    res.status(200).json({
      success: true,
      comment: commentWithLikes,
    });
  } catch (error) {
    console.error('Error fetching comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching comment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
