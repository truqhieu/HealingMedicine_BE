const express = require('express');
const router = express.Router();
const {
  resendVerificationEmail,
  checkRegistrationStatus,
  cancelRegistration
} = require('../controllers/tempRegister.controller');

// Gửi lại email xác thực
router.post('/resend-verification', resendVerificationEmail);

// Kiểm tra trạng thái đăng ký
router.get('/status', checkRegistrationStatus);

// Hủy đăng ký
router.delete('/cancel', cancelRegistration);

module.exports = router;
