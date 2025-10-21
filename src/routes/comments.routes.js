const express = require('express');
const router = express.Router();
const CommentsController = require('../controllers/comments.controller');

router.post('/:postId', CommentsController.createComment);
router.get('/:postId', CommentsController.getCommentsByPostId);
router.put('/:commentId/like', CommentsController.likeComment);
router.put('/:commentId', CommentsController.updateComment);
router.delete('/:commentId', CommentsController.deleteComment);
router.get('/single/:commentId', CommentsController.getCommentById);

module.exports = router;
