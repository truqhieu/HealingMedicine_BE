const express = require('express');
const router = express.Router();

const userRoutes = require('./user.route');
const adminRoutes = require('./admin.route');
const tempRegisterRoutes = require('./tempRegister.route');

router.use('/auth', userRoutes);
router.use('/admin', adminRoutes);

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
        createAccount : 'POST /api/admin/accounts',
        getAllAccounts : 'GET /api/admin/accounts',
        viewDetailAccount : 'GET /api/admin/accounts/:id',
        updateAccount : 'PATCH /api/admin/accounts/:id',
        lockAccount : 'PATCH /api/admin/accounts/lock/:id',
        unlockAccount : 'PATCH /api/admin/accounts/unlock/:id'
      }
    }
  });
});

module.exports = router;
