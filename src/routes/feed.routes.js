const express = require('express');
const router = express.Router();
const { getFeed, getInfiniteFeed } = require('../controllers/feed.controller');

router.get('/', getFeed);
router.get('/explore', getInfiniteFeed);

module.exports = router;
