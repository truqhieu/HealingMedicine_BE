const paymentService = require('../services/payment.service');
const sepayService = require('../services/sepay.service');

/**
 * Webhook từ Sepay khi có giao dịch mới
 */
const handleSepayWebhook = async (req, res) => {
  try {
    console.log('🔔 Nhận webhook từ Sepay:', req.body);

    // Validate webhook signature (nếu Sepay có)
    const signature = req.headers['x-sepay-signature'];
    if (signature && !sepayService.validateWebhook(signature, req.body)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    // Parse webhook data
    const webhookData = sepayService.parseWebhookData(req.body);
    
    // Lấy appointment ID từ content
    // Content format: "APPOINTMENT {shortId}"
    const content = webhookData.content;
    const match = content.match(/APPOINTMENT\s+([A-Z0-9]+)/i);
    
    if (!match) {
      console.log('⚠️  Không tìm thấy appointment ID trong content:', content);
      return res.status(200).json({ received: true });
    }

    const shortId = match[1];
    console.log('🔍 Short ID:', shortId);

    // Tìm appointment theo short ID (8 ký tự cuối)
    const Appointment = require('../models/appointment.model');
    const appointments = await Appointment.find({
      status: 'PendingPayment'
    }).populate('paymentId');

    const appointment = appointments.find(apt => {
      const aptShortId = apt._id.toString().slice(-8).toUpperCase();
      return aptShortId === shortId;
    });

    if (!appointment) {
      console.log('⚠️  Không tìm thấy appointment với shortId:', shortId);
      return res.status(200).json({ received: true });
    }

    console.log('✅ Tìm thấy appointment:', appointment._id);

    // Kiểm tra số tiền
    if (webhookData.amount < appointment.paymentId.amount) {
      console.log('⚠️  Số tiền không đúng:', webhookData.amount, 'vs', appointment.paymentId.amount);
      return res.status(200).json({ received: true });
    }

    // Confirm payment
    await paymentService.confirmPayment(appointment.paymentId._id, webhookData);

    console.log('✅ Payment confirmed successfully');

    res.status(200).json({
      success: true,
      message: 'Payment confirmed',
      appointmentId: appointment._id
    });

  } catch (error) {
    console.error('❌ Lỗi xử lý webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi xử lý webhook'
    });
  }
};

/**
 * Manual check payment status (cho user check)
 */
const checkPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Check và confirm payment nếu đã có giao dịch
    const result = await paymentService.checkAndConfirmPayment(paymentId);

    if (result && result.appointment) {
      return res.status(200).json({
        success: true,
        message: 'Thanh toán thành công',
        data: {
          payment: result.payment,
          appointment: result.appointment,
          confirmed: true
        }
      });
    }

    // Chưa có giao dịch
    const payment = await paymentService.getPaymentInfo(paymentId);
    
    res.status(200).json({
      success: true,
      message: 'Chưa nhận được thanh toán',
      data: {
        payment,
        confirmed: false
      }
    });

  } catch (error) {
    console.error('❌ Lỗi check payment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi kiểm tra thanh toán',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Lấy thông tin thanh toán
 */
const getPaymentInfo = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await paymentService.getPaymentInfo(paymentId);

    res.status(200).json({
      success: true,
      data: { payment }
    });

  } catch (error) {
    console.error('❌ Lỗi lấy payment info:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy thông tin thanh toán',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Manual confirm payment (cho admin)
 */
const manualConfirmPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Check if user is admin/staff
    if (!['Admin', 'Staff', 'Manager'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền thực hiện thao tác này'
      });
    }

    const result = await paymentService.confirmPayment(paymentId, {
      manualConfirm: true,
      confirmedBy: req.user.userId
    });

    res.status(200).json({
      success: true,
      message: 'Đã xác nhận thanh toán thủ công',
      data: result
    });

  } catch (error) {
    console.error('❌ Lỗi confirm payment:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi xác nhận thanh toán',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  handleSepayWebhook,
  checkPaymentStatus,
  getPaymentInfo,
  manualConfirmPayment
};

