const express = require('express');
const router = express.Router();
const {
  register,
  verifyEmail,
  login,
  getProfile,
  authenticateToken,
  fixUserPassword
} = require('../controllers/user.controller');

// Routes công khai (không cần authentication)
router.post('/register', register);
router.get('/verify-email', verifyEmail);
router.post('/login', login);

// Routes cần authentication
router.get('/profile', authenticateToken, getProfile);
module.exports = router;
