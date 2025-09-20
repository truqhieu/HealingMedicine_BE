const express = require('express');
const router = express.Router();

// Import routes
const userRoutes = require('./user.route');
const tempRegisterRoutes = require('./tempRegister.route');

// Authentication routes
router.use('/auth', userRoutes);

// Temporary registration routes
router.use('/temp-register', tempRegisterRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'HealingMedicine API',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        verifyEmail: 'GET /api/auth/verify-email',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile (requires token)'
      },
      tempRegister: {
        resendVerification: 'POST /api/temp-register/resend-verification',
        checkStatus: 'GET /api/temp-register/status',
        cancel: 'DELETE /api/temp-register/cancel'
      }
    }
  });
});

module.exports = router;
