const express = require('express');
const router = express.Router();
const {
  handleSepayWebhook,
  checkPaymentStatus,
  getPaymentInfo,
  manualConfirmPayment,
  testWebhook
} = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// ============================================
// WEBHOOK TỰ ĐỘNG - KHÔNG CẦN AUTH
// ============================================
// Endpoint này nhận thông báo từ Sepay và TỰ ĐỘNG xử lý thanh toán
// Khi khách hàng chuyển khoản → Sepay gửi webhook → Hệ thống tự động confirm
router.post('/webhook/sepay', handleSepayWebhook);

// Test webhook endpoint (để test cấu hình)
router.get('/webhook/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: '✅ Webhook endpoint hoạt động bình thường',
    webhookUrl: '/api/payments/webhook/sepay',
    method: 'POST',
    info: 'Endpoint này nhận thông báo từ Sepay và TỰ ĐỘNG xử lý thanh toán',
    timestamp: new Date().toISOString()
  });
});

// Test webhook với mock data (cho admin debug)
router.post('/webhook/test', verifyToken, testWebhook);

// ============================================
// CÁC ENDPOINT KHÁC (CẦN AUTH)
// ============================================

// Check payment status (cho user/frontend check nếu muốn)
router.get('/:paymentId/check', verifyToken, checkPaymentStatus);

// Get payment info
router.get('/:paymentId', verifyToken, getPaymentInfo);

// Manual confirm payment (CHỈ dành cho admin khi webhook bị lỗi)
// BẠN KHÔNG CẦN DÙNG ENDPOINT NÀY vì webhook đã tự động
router.post('/:paymentId/confirm', verifyToken, manualConfirmPayment);

module.exports = router;

