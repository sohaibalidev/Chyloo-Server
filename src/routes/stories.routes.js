const express = require('express');
const router = express.Router();
const storiesController = require('../controllers/stories.controller');
const upload = require('../config/multer.config');

router.post('/', upload.single('media'), storiesController.createStory);
router.get('/following', storiesController.getFollowedStories);
router.get('/user/:userId', storiesController.getUserStories);
router.delete('/:storyId', storiesController.deleteStory);

module.exports = router;
