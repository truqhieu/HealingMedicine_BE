const express = require('express');
const router = express.Router();
const {
  handleSepayWebhook,
  checkPaymentStatus,
  getPaymentInfo,
  manualConfirmPayment
} = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Webhook từ Sepay (không cần auth)
router.post('/webhook/sepay', handleSepayWebhook);

// Check payment status (user tự check)
router.get('/:paymentId/check', verifyToken, checkPaymentStatus);

// Get payment info
router.get('/:paymentId', verifyToken, getPaymentInfo);

// Manual confirm payment (admin only)
router.post('/:paymentId/confirm', verifyToken, manualConfirmPayment);

module.exports = router;

