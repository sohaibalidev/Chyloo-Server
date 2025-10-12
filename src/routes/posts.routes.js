const express = require('express');
const router = express.Router();
const posts = require('../controllers/posts.controller');
// const comments = require('../controllers/comments.controller');

const upload = require('../config/multer.config');

// Post routes
router.get('/user/:userId/all', posts.getPostsByUserId);
router.get('/user/:userId/saved', posts.getSavedPostsByUserId);
router.get('/:id', posts.getPostById);
router.post('/', upload.array('media', 10), posts.createPost);
router.delete('/:id', posts.deletePost);
router.post('/:postId/save', posts.savePost);
router.post('/:postId/like', posts.likePost);

// Comment routes
// router.post('/:postId/comments', comments.addComment); 
// router.post('/:postId/comments/:commentId/like', comments.likeComment);
// router.post('/:postId/comments/:commentId/reply', comments.replyToComment);
// router.get('/:postId/comments', comments.getPostComments); 
// router.delete('/:postId/comments/:commentId', comments.deleteComment);

module.exports = router;
