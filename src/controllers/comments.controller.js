const { Comment, Post, User, Like } = require('../models/');

exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.visibility === 'private' && post.authorId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You cannot comment on this private post',
      });
    }

    const comment = new Comment({
      postId,
      authorId: userId,
      text,
      likesCount: 0,
    });

    const savedComment = await comment.save();
    await savedComment.populate('authorId', 'username name avatar');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: savedComment,
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

exports.likeComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const post = await Post.findById(comment.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    comment.likesCount += 1;
    await comment.save();

    res.status(200).json({
      message: 'Comment liked successfully',
      likesCount: comment.likesCount,
    });
  } catch (error) {
    console.error('Error liking comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.replyToComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      return res.status(404).json({ message: 'Parent comment not found' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.visibility === 'private' && post.authorId.toString() !== userId) {
      return res.status(403).json({ message: 'You cannot comment on this private post' });
    }

    const reply = new Comment({
      postId,
      authorId: userId,
      text,
      replyTo: commentId,
      likesCount: 0,
    });

    const savedReply = await reply.save();

    await savedReply.populate('authorId', 'username name avatar');

    res.status(201).json({
      message: 'Reply added successfully',
      reply: savedReply,
    });
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.visibility === 'private' && post.authorId.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to view comments on this post' });
    }

    const comments = await Comment.find({ postId, replyTo: null }) // Only top-level comments
      .populate('authorId', 'username name avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await Comment.find({ replyTo: comment._id })
          .populate('authorId', 'username name avatar')
          .sort({ createdAt: 1 })
          .limit(5);

        return {
          ...comment.toObject(),
          replies,
        };
      })
    );

    const totalComments = await Comment.countDocuments({ postId, replyTo: null });

    res.status(200).json({
      comments: commentsWithReplies,
      totalComments,
      totalPages: Math.ceil(totalComments / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const post = await Post.findById(comment.postId);
    const isCommentAuthor = comment.authorId.toString() === userId;
    const isPostAuthor = post.authorId.toString() === userId;

    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await Comment.deleteMany({
      $or: [{ _id: commentId }, { replyTo: commentId }],
    });

    res.status(200).json({
      message: 'Comment and its replies deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
    });
  }
};
