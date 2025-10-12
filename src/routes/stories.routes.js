const express = require('express');
const router = express.Router();
const storiesController = require('../controllers/stories.controller');

router.get('/', storiesController.getStoriesForFeed);
router.post('/', storiesController.createStory);
router.delete('/:storyId', storiesController.deleteStory);
router.get('/user/:userId', storiesController.getUserStories);

module.exports = router;
