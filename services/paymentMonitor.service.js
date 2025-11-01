const Payment = require('../models/payment.model');
const Appointment = require('../models/appointment.model');
const paymentService = require('./payment.service');

class PaymentMonitorService {
  
  /**
   * Auto-expire các payment đã hết hạn (quá 15 phút)
   */
  async expireOldPayments() {
    try {
      // Tìm các payment đã hết hạn nhưng vẫn pending
      const expiredPayments = await Payment.find({
        status: 'Pending',
        holdExpiresAt: { $lt: new Date() } // Đã hết hạn
      }).populate('appointmentId');

      if (expiredPayments.length === 0) {
        return;
      }

      console.log(`⏰ [PaymentMonitor] Tìm thấy ${expiredPayments.length} payment(s) đã hết hạn`);

      // Hủy từng payment
      for (const payment of expiredPayments) {
        try {
          console.log(`❌ [PaymentMonitor] Hủy payment ${payment._id}...`);
          
          await paymentService.cancelExpiredPayment(payment._id);

          console.log(`✅ [PaymentMonitor] Payment ${payment._id} đã bị hủy do hết hạn`);

        } catch (error) {
          console.error(`❌ [PaymentMonitor] Lỗi expire payment ${payment._id}:`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ [PaymentMonitor] Lỗi expire payments:', error.message);
    }
  }

  /**
   * Khởi động monitoring (chạy định kỳ)
   */
  startMonitoring(intervalMinutes = 1) {
    console.log(`🚀 [PaymentMonitor] Bắt đầu auto-check Sepay (mỗi ${intervalMinutes} phút)`);

    // Check pending payments mỗi X phút
    const intervalMs = intervalMinutes * 60 * 1000;

    // Chạy check expired
    setInterval(() => {
      this.expireOldPayments();
    }, intervalMs);

    // ⭐ THÊM: Sync timeslot status (để handle manual payment status changes)
    setInterval(() => {
      const paymentService = require('./payment.service');
      paymentService.syncTimeslotStatus();
    }, intervalMs);

    // Chạy ngay lần đầu
    console.log('🔍 [PaymentMonitor] Chạy check đầu tiên...\n');
    this.expireOldPayments();
    
    // Sync ngay lần đầu
    const paymentService = require('./payment.service');
    paymentService.syncTimeslotStatus();
  }
}

module.exports = new PaymentMonitorService();

