const { Story, Follow } = require('../models/');
const mongoose = require('mongoose');

exports.getStoriesForFeed = async (req, res) => {
  try {
    const followingDocs = await Follow.find({ followerId: req.user._id }).select('followingId');
    const followingIds = followingDocs.map((f) => f.followingId);
    followingIds.push(req.user._id);

    const stories = await Story.aggregate([
      {
        $match: {
          authorId: { $in: followingIds.map((id) => new mongoose.Types.ObjectId(id)) },
          expiresAt: { $gt: new Date() },
          isActive: true,
        },
      },
      {
        $group: {
          _id: '$authorId',
          stories: { $push: '$$ROOT' },
          latestStory: { $max: '$createdAt' },
        },
      },
      { $sort: { latestStory: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          'user.passwordHash': 0,
          'user.email': 0,
          'user.resetToken': 0,
          'user.resetTokenExpiry': 0,
        },
      },
    ]);

    const transformedStories = stories.map((userStory) => ({
      id: userStory._id.toString(),
      username: userStory.user.username,
      avatar: userStory.user.avatar,
      stories: userStory.stories.map((story) => ({
        id: story._id.toString(),
        image: story.media.url,
        type: story.media.type,
        duration: story.media.duration,
        caption: story.caption,
        createdAt: story.createdAt,
      })),
    }));

    res.status(200).json({
      success: true,
      stories: transformedStories,
    });
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stories',
    });
  }
};

exports.createStory = async (req, res) => {
  try {
    const { mediaUrl, mediaType, caption } = req.body;

    if (!mediaUrl || !mediaType) {
      return res.status(400).json({
        success: false,
        message: 'Media URL and type are required',
      });
    }

    const story = new Story({
      authorId: req.user._id,
      media: {
        url: mediaUrl,
        type: mediaType,
        duration: mediaType === 'video' ? 15 : 7,
      },
      caption,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await story.save();

    const populatedStory = await Story.findById(story._id).populate('authorId', 'username avatar');

    res.status(201).json({
      success: true,
      story: {
        id: populatedStory._id.toString(),
        username: populatedStory.authorId.username,
        avatar: populatedStory.authorId.avatar,
        image: populatedStory.media.url,
        type: populatedStory.media.type,
        caption: populatedStory.caption,
        createdAt: populatedStory.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating story',
    });
  }
};

exports.deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findOne({
      _id: storyId,
      authorId: req.user._id,
    });

    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story not found or not authorized',
      });
    }

    await Story.findByIdAndDelete(storyId);

    res.status(200).json({
      success: true,
      message: 'Story deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting story:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting story',
    });
  }
};

exports.getUserStories = async (req, res) => {
  try {
    const { userId } = req.params;

    const stories = await Story.find({
      authorId: userId,
      expiresAt: { $gt: new Date() },
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .populate('authorId', 'username avatar');

    const transformedStories = stories.map((story) => ({
      id: story._id.toString(),
      username: story.authorId.username,
      avatar: story.authorId.avatar,
      image: story.media.url,
      type: story.media.type,
      caption: story.caption,
      createdAt: story.createdAt,
    }));

    res.status(200).json({
      success: true,
      stories: transformedStories,
    });
  } catch (error) {
    console.error('Error fetching user stories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user stories',
    });
  }
};
