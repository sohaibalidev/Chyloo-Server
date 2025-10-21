const { Story, User } = require('../models');
const cloudinary = require('../config/cloudinary.config');

// Create a new story
exports.createStory = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Media file is required' });
    }

    let uploadResult;
    try {
      uploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
        folder: 'stories',
      });
    } catch (uploadError) {
      return res.status(500).json({ error: 'Failed to upload media to Cloudinary' });
    }

    const mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
    const defaultDuration = mediaType === 'video' ? 15 : 7;

    const story = new Story({
      authorId: req.user.id,
      media: {
        url: uploadResult.secure_url,
        type: mediaType,
        duration: defaultDuration,
      },
      caption: req.body.caption || '',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await story.save();
    await story.populate('authorId', 'username avatar name');

    res.status(201).json({
      message: 'Story created successfully',
      story,
    });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get stories from followed users
exports.getFollowedStories = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const currentUser = await User.findById(currentUserId).select('following');
    const followingIds = currentUser.following || [];
    const userIds = [...followingIds, currentUserId];

    const stories = await Story.find({
      authorId: { $in: userIds },
      expiresAt: { $gt: new Date() },
      isActive: true,
    })
      .populate('authorId', 'username avatar name')
      .sort({ createdAt: -1 });

    const storiesByUser = stories.reduce((acc, story) => {
      const userId = story.authorId._id.toString();
      if (!acc[userId]) {
        acc[userId] = { user: story.authorId, stories: [] };
      }
      acc[userId].stories.push(story);
      return acc;
    }, {});

    res.json({ stories: storiesByUser });
  } catch (error) {
    console.error('Get followed stories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user's active stories
exports.getUserStories = async (req, res) => {
  try {
    const userId = req.params.userId;
    const stories = await Story.getActiveStoriesByUserId(userId).populate(
      'authorId',
      'username avatar name'
    );
    res.json({ stories });
  } catch (error) {
    console.error('Get user stories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a story
exports.deleteStory = async (req, res) => {
  try {
    const story = await Story.findOne({
      _id: req.params.storyId,
      authorId: req.user.id,
    });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    await Story.findByIdAndDelete(req.params.storyId);
    res.json({ message: 'Story deleted successfully' });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mark expired stories as inactive (cron job)
exports.deactivateExpiredStories = async () => {
  try {
    const result = await Story.updateMany(
      {
        expiresAt: { $lte: new Date() },
        isActive: true,
      },
      { isActive: false }
    );
    console.log(`Deactivated ${result.modifiedCount} expired stories`);
  } catch (error) {
    console.error('Deactivate expired stories error:', error);
  }
};
