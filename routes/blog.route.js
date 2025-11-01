const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const { verifyToken, verifyRole } = require('../middleware/auth.middleware');
const {createBlog, getAllBlogs, viewDetailBlogs, updateBlog, deleteBlog} = require('../controllers/blog.controller')

router.post('/blogs', verifyToken, verifyRole('Manager'),upload.single('thumbnailUrl'),createBlog)
router.get('/blogs', verifyToken, verifyRole('Manager'),getAllBlogs)
router.get('/blogs/:id',viewDetailBlogs)
router.patch('/blogs/:id', verifyToken, verifyRole('Manager'),upload.single('thumbnailUrl'),updateBlog)
router.delete('/blogs/:id', verifyToken, verifyRole('Manager'),deleteBlog)

module.exports = router