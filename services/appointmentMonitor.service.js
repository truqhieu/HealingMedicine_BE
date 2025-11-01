const Appointment = require('../models/appointment.model');
const DoctorSchedule = require('../models/doctorSchedule.model');

/**
 * Service để monitor và auto-expire các appointment
 * - Chạy định kỳ để check và update status appointments dựa trên endTime của buổi làm việc:
 *   + Pending, Approved → sau endTime buổi chiều → Expired
 *   + CheckedIn → sau endTime buổi chiều → No-Show
 *   + InProgress → sau endTime buổi chiều → Completed
 */
class AppointmentMonitorService {
  
  /**
   * Helper: Tính endTime của buổi làm việc từ DoctorSchedule
   * @param {Object} schedules - Array of DoctorSchedule
   * @param {Date} appointmentDate - Ngày của appointment
   * @returns {Date|null} - EndTime của buổi chiều (hoặc buổi làm việc cuối cùng trong ngày)
   */
  _getScheduleEndTime(schedules, appointmentDate) {
    if (!schedules || schedules.length === 0) {
      return null;
    }

    const appointmentDateOnly = new Date(appointmentDate);
    appointmentDateOnly.setUTCHours(0, 0, 0, 0);

    let maxEndTime = null;

    for (const schedule of schedules) {
      const workingHours = schedule.workingHours || {
        morningStart: '08:00',
        morningEnd: '12:00',
        afternoonStart: '14:00',
        afternoonEnd: '18:00'
      };

      // Lấy endTime của buổi chiều (nếu có) hoặc buổi làm việc
      if (schedule.shift === 'Afternoon') {
        const [endHour, endMinute] = workingHours.afternoonEnd.split(':').map(Number);
        const endTime = new Date(appointmentDateOnly);
        endTime.setUTCHours(endHour - 7, endMinute, 0, 0); // Convert VN time to UTC
        if (!maxEndTime || endTime > maxEndTime) {
          maxEndTime = endTime;
        }
      } else if (schedule.shift === 'Morning') {
        // Nếu chỉ có buổi sáng, lấy endTime buổi sáng
        const [endHour, endMinute] = workingHours.morningEnd.split(':').map(Number);
        const endTime = new Date(appointmentDateOnly);
        endTime.setUTCHours(endHour - 7, endMinute, 0, 0);
        // Chỉ dùng nếu không có buổi chiều
        if (!maxEndTime) {
          maxEndTime = endTime;
        }
      }
    }

    return maxEndTime;
  }

  /**
   * Auto-update status appointments dựa trên endTime của buổi làm việc
   * - Pending, Approved → sau endTime buổi chiều → Expired
   * - CheckedIn → sau endTime buổi chiều → No-Show
   * - InProgress → sau endTime buổi chiều → Completed
   */
  async expireAppointments() {
    try {
      console.log('\n🔍 [AppointmentMonitor] Checking for appointments to update status...');

      // Lấy thời gian hiện tại (UTC)
      const now = new Date();
      
      // Tìm tất cả appointments cần check (Pending, Approved, CheckedIn, InProgress)
      const appointments = await Appointment.find({
        status: { $in: ['Pending', 'Approved', 'CheckedIn', 'InProgress'] }
      })
        .populate('timeslotId', 'startTime endTime')
        .populate('doctorUserId', '_id');

      if (!appointments || appointments.length === 0) {
        console.log('   ✅ Không có appointment nào cần check');
        return;
      }

      console.log(`   📋 Tìm thấy ${appointments.length} appointment(s) cần check`);

      let expiredCount = 0;
      let noShowCount = 0;
      let completedCount = 0;

      for (const appointment of appointments) {
        if (!appointment.timeslotId || !appointment.timeslotId.startTime || !appointment.doctorUserId) {
          continue;
        }

        try {
          // Lấy ngày khám từ timeslot
          const appointmentDate = new Date(appointment.timeslotId.startTime);
          const appointmentDateOnly = new Date(appointmentDate);
          appointmentDateOnly.setUTCHours(0, 0, 0, 0);

          // Tìm DoctorSchedule của bác sĩ trong ngày đó
          const startOfDay = new Date(appointmentDateOnly);
          const endOfDay = new Date(appointmentDateOnly);
          endOfDay.setUTCHours(23, 59, 59, 999);

          const schedules = await DoctorSchedule.find({
            doctorUserId: appointment.doctorUserId._id || appointment.doctorUserId,
            date: {
              $gte: startOfDay,
              $lte: endOfDay
            }
          });

          if (!schedules || schedules.length === 0) {
            // Nếu không có schedule, dùng mặc định 18:00 cho buổi chiều
            const defaultEndTime = new Date(appointmentDateOnly);
            defaultEndTime.setUTCHours(18 - 7, 0, 0, 0); // 18:00 VN = 11:00 UTC
            
            if (now >= defaultEndTime) {
              const oldStatus = appointment.status;
              const updated = await this._updateAppointmentStatus(appointment, now);
              if (updated) {
                if (oldStatus === 'Pending' || oldStatus === 'Approved') {
                  expiredCount++;
                } else if (oldStatus === 'CheckedIn') {
                  noShowCount++;
                } else if (oldStatus === 'InProgress') {
                  completedCount++;
                }
              }
            }
            continue;
          }

          // Tính endTime của buổi làm việc (ưu tiên buổi chiều)
          const scheduleEndTime = this._getScheduleEndTime(schedules, appointmentDate);

          if (!scheduleEndTime) {
            console.log(`   ⚠️  Không thể xác định endTime cho appointment ${appointment._id}`);
            continue;
          }

          // Kiểm tra: Nếu hiện tại đã qua endTime của buổi làm việc
          if (now >= scheduleEndTime) {
            const oldStatus = appointment.status;
            const updated = await this._updateAppointmentStatus(appointment, now, scheduleEndTime);
            
            if (updated) {
              if (oldStatus === 'Pending' || oldStatus === 'Approved') {
                expiredCount++;
              } else if (oldStatus === 'CheckedIn') {
                noShowCount++;
              } else if (oldStatus === 'InProgress') {
                completedCount++;
              }
            }
          }
        } catch (err) {
          console.error(`   ❌ Lỗi xử lý appointment ${appointment._id}:`, err.message);
          continue;
        }
      }

      if (expiredCount > 0 || noShowCount > 0 || completedCount > 0) {
        console.log(`   ✅ Đã update: ${expiredCount} Expired, ${noShowCount} No-Show, ${completedCount} Completed`);
      } else {
        console.log('   ✅ Không có appointment nào cần update');
      }

    } catch (error) {
      console.error('❌ [AppointmentMonitor] Lỗi khi check appointments:', error);
    }
  }

  
  async _updateAppointmentStatus(appointment, now, scheduleEndTime = null) {
    const oldStatus = appointment.status;
    let newStatus = null;

    if (appointment.status === 'Pending' || appointment.status === 'Approved') {
      newStatus = 'Expired';
    } else if (appointment.status === 'CheckedIn') {
      newStatus = 'No-Show';
    } else if (appointment.status === 'InProgress') {
      newStatus = 'Completed';
    }

    if (newStatus) {
      console.log(`   ✅ UPDATE: Appointment ${appointment._id}`);
      console.log(`      - Old Status: ${oldStatus}`);
      console.log(`      - New Status: ${newStatus}`);
      if (scheduleEndTime) {
        console.log(`      - Schedule EndTime: ${scheduleEndTime.toISOString()}`);
      }
      console.log(`      - Hiện tại: ${now.toISOString()}`);

      appointment.status = newStatus;
      await appointment.save();
      return true;
    }
    
    return false;
  }

  /**
   * Khởi động monitoring (chạy định kỳ)
   * @param {number} intervalMinutes - Số phút giữa mỗi lần check (mặc định 60 phút = 1 giờ)
   */
  startMonitoring(intervalMinutes = 60) {
    console.log(`🚀 [AppointmentMonitor] Bắt đầu auto-check appointments (mỗi ${intervalMinutes} phút)`);

    const intervalMs = intervalMinutes * 60 * 1000;

    // Check appointments mỗi X phút
    setInterval(() => {
      this.expireAppointments();
    }, intervalMs);

    // Chạy ngay lần đầu tiên
    console.log('🔍 [AppointmentMonitor] Chạy check đầu tiên...');
    this.expireAppointments();
  }
}

module.exports = new AppointmentMonitorService();

