const Payment = require('../models/payment.model');
const Appointment = require('../models/appointment.model');
const paymentService = require('./payment.service');

class PaymentMonitorService {
  
  /**
   * Auto-check tất cả pending payments
   * Chạy định kỳ mỗi 1-2 phút để check Sepay
   */
  async checkPendingPayments() {
    try {
      console.log('🔄 [PaymentMonitor] Đang check pending payments...');

      // Tìm tất cả payment đang pending và chưa hết hạn
      const pendingPayments = await Payment.find({
        status: 'Pending',
        holdExpiresAt: { $gt: new Date() } // Chưa hết hạn
      }).populate('appointmentId');

      if (pendingPayments.length === 0) {
        console.log('✅ [PaymentMonitor] Không có payment pending');
        return;
      }

      console.log(`📊 [PaymentMonitor] Tìm thấy ${pendingPayments.length} payment(s) đang chờ`);

      // Check từng payment
      for (const payment of pendingPayments) {
        try {
          console.log(`🔍 [PaymentMonitor] Checking payment ${payment._id}...`);
          
          // Auto-check và confirm nếu tìm thấy giao dịch từ Sepay
          const result = await paymentService.checkAndConfirmPayment(payment._id);

          if (result) {
            console.log(`✅ [PaymentMonitor] Payment ${payment._id} ĐÃ ĐƯỢC XÁC NHẬN TỰ ĐỘNG!`);
            console.log(`   - Appointment ${result.appointment._id} → Status: ${result.appointment.status}`);
            console.log(`   - Email xác nhận đã được gửi ✅`);
          } else {
            console.log(`⏳ [PaymentMonitor] Payment ${payment._id} chưa có giao dịch trên Sepay`);
          }

        } catch (error) {
          console.error(`❌ [PaymentMonitor] Lỗi check payment ${payment._id}:`, error.message);
        }
      }

      console.log('✅ [PaymentMonitor] Hoàn tất check cycle\n');

    } catch (error) {
      console.error('❌ [PaymentMonitor] Lỗi check pending payments:', error.message);
    }
  }

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

    // Chạy check pending
    setInterval(() => {
      this.checkPendingPayments();
    }, intervalMs);

    // Chạy check expired
    setInterval(() => {
      this.expireOldPayments();
    }, intervalMs);

    // Chạy ngay lần đầu
    console.log('🔍 [PaymentMonitor] Chạy check đầu tiên...\n');
    this.checkPendingPayments();
    this.expireOldPayments();
  }
}

module.exports = new PaymentMonitorService();

