const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');

/**
 * @route GET /api/search
 * @desc Search across users and posts
 * @access Private
 * @query {string} q - Search query
 * @query {number} [page=1] - Page number
 * @query {number} [limit=10] - Results per page
 * @query {string} [type=all] - Search type: 'all', 'users', or 'posts'
 */
router.get('/', searchController.searchAll);

module.exports = router;
