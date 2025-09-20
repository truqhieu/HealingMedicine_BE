const express = require('express');
const router = express.Router();

// Import routes
const userRoutes = require('./user.route');
const adminRoutes = require('./admin.route');
const tempRegisterRoutes = require('./tempRegister.route');

// Authentication routes
router.use('/auth', userRoutes);
router.use('/admin', adminRoutes);

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
      },
      admin :{
        getAllUsers : 'GET /api/admin/all',
        getUserById : 'GET /api/admin/:id',
        createAccount : 'POST /api/admin/create',
        updateUser : 'PATCH /api/admin/:id',
        bulkUpdateUser : 'POST /api/admin/bulk-update'
      }
    }
  });
});

module.exports = router;
