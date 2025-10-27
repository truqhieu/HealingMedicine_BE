const Appointment = require('../models/appointment.model');

/**
 * Service để monitor và auto-expire các appointment
 * - Chạy định kỳ để check appointments "Pending" đã hết hạn (qua 18:00)
 */
class AppointmentMonitorService {
  
  /**
   * Auto-expire các appointment "Pending" đã qua 18:00 của ngày hẹn
   */
  async expirePendingAppointments() {
    try {
      console.log('\n🔍 [AppointmentMonitor] Checking for expired pending appointments...');

      // Lấy thời gian hiện tại (UTC)
      const now = new Date();
      
      // Tìm tất cả appointments đang "Pending"
      const pendingAppointments = await Appointment.find({
        status: 'Pending'
      }).populate('timeslotId', 'startTime endTime');

      if (!pendingAppointments || pendingAppointments.length === 0) {
        console.log('   ✅ Không có appointment "Pending" nào');
        return;
      }

      console.log(`   📋 Tìm thấy ${pendingAppointments.length} appointment(s) đang Pending`);

      let expiredCount = 0;

      for (const appointment of pendingAppointments) {
        if (!appointment.timeslotId || !appointment.timeslotId.startTime) {
          continue;
        }

        // Lấy ngày khám từ timeslot
        const appointmentDate = new Date(appointment.timeslotId.startTime);
        
        // Tạo cutoff time: 18:00 UTC của ngày hẹn
        const cutoffTime = new Date(appointmentDate);
        cutoffTime.setUTCHours(18, 0, 0, 0);

        // Kiểm tra: Nếu hiện tại đã qua 18:00 của ngày hẹn
        if (now >= cutoffTime) {
          console.log(`   ⏰ EXPIRED: Appointment ${appointment._id}`);
          console.log(`      - Ngày hẹn: ${appointmentDate.toISOString()}`);
          console.log(`      - Cutoff: ${cutoffTime.toISOString()}`);
          console.log(`      - Hiện tại: ${now.toISOString()}`);

          // Update status sang "Expired"
          appointment.status = 'Expired';
          await appointment.save();

          // TODO: Có thể gửi email thông báo cho user
          // const emailService = require('./email.service');
          // await emailService.sendAppointmentExpiredEmail(...)

          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        console.log(`   ✅ Đã expire ${expiredCount} appointment(s)`);
      } else {
        console.log('   ✅ Không có appointment nào cần expire');
      }

    } catch (error) {
      console.error('❌ [AppointmentMonitor] Lỗi khi check expired appointments:', error);
    }
  }

  /**
   * Khởi động monitoring (chạy định kỳ)
   * @param {number} intervalMinutes - Số phút giữa mỗi lần check (mặc định 60 phút = 1 giờ)
   */
  startMonitoring(intervalMinutes = 60) {
    console.log(`🚀 [AppointmentMonitor] Bắt đầu auto-check expired appointments (mỗi ${intervalMinutes} phút)`);

    const intervalMs = intervalMinutes * 60 * 1000;

    // Check appointments mỗi X phút
    setInterval(() => {
      this.expirePendingAppointments();
    }, intervalMs);

    // Chạy ngay lần đầu tiên
    console.log('🔍 [AppointmentMonitor] Chạy check đầu tiên...');
    this.expirePendingAppointments();
  }
}

module.exports = new AppointmentMonitorService();

