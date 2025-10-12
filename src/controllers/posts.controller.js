const config = require('../config/app.config');
const enhancePosts = require('../helpers/post-enhancer');
const { Post, Follow, User, Like } = require('../models/');

exports.createPost = async (req, res) => {
  try {
    const { caption, visibility } = req.body;
    const authorId = req.user._id;
    let media = [];

    const allowedVisibilities = ['public', 'private', 'followers'];
    const postVisibility = allowedVisibilities.includes(visibility) ? visibility : 'public';

    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file) =>
        cloudinary.uploader.upload(file.path, {
          folder: 'posts',
          resource_type: 'auto',
        })
      );

      const results = await Promise.all(uploadPromises);
      media = results.map((r) => ({
        url: r.secure_url,
        type: r.resource_type === 'image' || r.resource_type === 'video' ? r.resource_type : 'file',
      }));
    }

    const newPost = await Post.create({
      authorId,
      caption,
      media,
      visibility: postVisibility,
    });

    await newPost.populate('authorId', 'username name avatar');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: newPost,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error creating post. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

exports.likePost = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post)
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });

    const existingLike = await Like.findOne({ targetId: postId, userId, type: 'post' });

    if (existingLike) {
      await existingLike.deleteOne();
      return res.status(200).json({
        success: true,
        isLiked: false,
        message: 'Post unliked',
      });
    } else {
      await Like.create({ targetId: postId, userId, type: 'post' });
      return res.status(200).json({
        success: true,
        isLiked: true,
        message: 'Post liked',
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

exports.savePost = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post)
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });

    const index = user.savedPosts.indexOf(postId);
    if (index === -1) {
      user.savedPosts.push(postId);
    } else {
      user.savedPosts.splice(index, 1);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: index === -1 ? 'Post saved' : 'Post removed from saved',
      savedPosts: user.savedPosts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Internal Server error',
      error: config.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('authorId', 'username name avatar');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (post.visibility === 'private') {
      if (post.authorId._id.toString() !== req.user._id.toString()) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }
    }

    if (post.visibility === 'followers') {
      if (post.authorId._id.toString() !== req.user._id.toString()) {
        const isFollowing = await Follow.exists({
          followerId: req.user._id,
          followingId: post.authorId._id,
        });

        if (!isFollowing) {
          return res.status(404).json({
            success: false,
            message: 'Post not found',
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      post,
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching post. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

exports.getPostsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = { authorId: userId };

    if (req.user._id.toString() !== userId) {
      let allowedVisibilities = ['public'];

      const isFollowing = await Follow.exists({
        followerId: req.user._id,
        followingId: userId,
      });

      if (isFollowing) {
        allowedVisibilities.push('followers');
      }

      query.visibility = { $in: allowedVisibilities };
    }

    const posts = await Post.find(query)
      .populate('authorId', 'username name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(query);
    const hasMore = skip + posts.length < total;

    const enhancedPosts = await enhancePosts(posts, req.user);

    res.status(200).json({
      success: true,
      posts: enhancedPosts,
      pagination: {
        current: page,
        hasMore,
        total,
      },
    });
  } catch (err) {
    console.log(err);
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching posts',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

exports.getSavedPostsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId).select('savedPosts');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const savedPostIds = user.savedPosts;

    if (savedPostIds.length === 0) {
      return res.status(200).json({
        success: true,
        posts: [],
        pagination: {
          current: page,
          hasMore: false,
          total: 0,
        },
      });
    }

    let query = { _id: { $in: savedPostIds } };

    if (req.user._id.toString() !== userId) {
      let allowedVisibilities = ['public'];

      const isFollowing = await Follow.exists({
        followerId: req.user._id,
        followingId: userId,
      });

      if (isFollowing) {
        allowedVisibilities.push('followers');
      }

      query.visibility = { $in: allowedVisibilities };
    }

    const posts = await Post.find(query)
      .populate('authorId', 'username name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(query);
    const hasMore = skip + posts.length < total;

    const enhancedPosts = await enhancePosts(posts, req.user);

    res.status(200).json({
      success: true,
      posts: enhancedPosts,
      pagination: {
        current: page,
        hasMore,
        total,
      },
    });
  } catch (err) {
    console.log(err);
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching saved posts',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (post.authorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this post',
      });
    }

    if (post.media?.length) {
      const deletePromises = post.media
        .filter((file) => file.public_id)
        .map((file) => cloudinary.uploader.destroy(file.public_id, { resource_type: 'auto' }));

      await Promise.allSettled(deletePromises);
    }

    await post.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error deleting post',
      error: err.message,
    });
  }
};
