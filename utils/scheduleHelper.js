
class ScheduleHelper {

 
  static determineShift(datetime) {
    const hour = datetime.getHours();
    const minute = datetime.getMinutes();
    const timeInMinutes = hour * 60 + minute;
    
    // 8:00 = 480 phút, 13:00 = 780 phút
    if (timeInMinutes >= 480 && timeInMinutes < 780) {
      return 'Morning';
    } else if (timeInMinutes >= 780) {
      return 'Afternoon';
    }
    
    throw new Error('Thời gian không thuộc ca làm việc');
  }


  static generateTimeslots(params) {
    const {
      doctorScheduleId,
      doctorUserId,
      serviceId,
      scheduleStartTime,
      scheduleEndTime,
      serviceDurationMinutes,
      breakAfterMinutes = 10
    } = params;

    // Validate input
    if (!scheduleStartTime || !scheduleEndTime) {
      throw new Error('Thiếu thông tin thời gian làm việc');
    }

    if (!serviceDurationMinutes || serviceDurationMinutes <= 0) {
      throw new Error('Thời lượng dịch vụ không hợp lệ');
    }

    const timeslots = [];
    let currentStartTime = new Date(scheduleStartTime);
    const endTime = new Date(scheduleEndTime);

    console.log('🕐 Bắt đầu tính toán timeslots:');
    console.log('   - Thời gian làm việc:', this.formatTimeSlot(currentStartTime, endTime));
    console.log('   - Thời lượng dịch vụ:', serviceDurationMinutes, 'phút');
    console.log('   - Thời gian nghỉ:', breakAfterMinutes, 'phút');

    let slotCount = 0;

    // Tạo timeslots cho đến khi hết thời gian làm việc
    while (currentStartTime < endTime) {
      // Tính thời gian kết thúc của slot này (start + duration)
      const currentEndTime = new Date(currentStartTime.getTime() + serviceDurationMinutes * 60000);

      // Kiểm tra xem slot này có vượt quá thời gian làm việc không
      if (currentEndTime > endTime) {
        console.log(`   ⚠️ Slot ${slotCount + 1} vượt quá giờ làm việc, dừng tại đây`);
        break;
      }

      // Tạo timeslot
      timeslots.push({
        doctorScheduleId,
        doctorUserId,
        serviceId,
        startTime: new Date(currentStartTime),
        endTime: new Date(currentEndTime),
        breakAfterMinutes,
        status: 'Available',
        appointmentId: null
      });

      slotCount++;
      console.log(`   ✅ Slot ${slotCount}:`, this.formatTimeSlot(currentStartTime, currentEndTime));

      // Tính thời gian bắt đầu slot tiếp theo (end + break)
      currentStartTime = new Date(currentEndTime.getTime() + breakAfterMinutes * 60000);
    }

    console.log(`   📊 Tổng cộng tạo được ${slotCount} timeslots`);

    return timeslots;
  }

  static generateTimeslotsForMultipleServices(params) {
    const {
      doctorScheduleId,
      doctorUserId,
      scheduleStartTime,
      scheduleEndTime,
      services,
      breakAfterMinutes = 10
    } = params;

    const allTimeslots = [];

    services.forEach(service => {
      const timeslots = this.generateTimeslots({
        doctorScheduleId,
        doctorUserId,
        serviceId: service.serviceId,
        scheduleStartTime,
        scheduleEndTime,
        serviceDurationMinutes: service.durationMinutes,
        breakAfterMinutes
      });

      allTimeslots.push(...timeslots);
    });

    return allTimeslots;
  }

  /**
   * Lấy timeslots available cho một service cụ thể
   * @param {Array} allTimeslots - Tất cả timeslots
   * @param {ObjectId} serviceId - ID dịch vụ cần lọc
   * @returns {Array} - Timeslots của service đó
   */
  static filterTimeslotsByService(allTimeslots, serviceId) {
    return allTimeslots.filter(slot => 
      slot.serviceId.toString() === serviceId.toString() && 
      slot.status === 'Available'
    );
  }

  /**
   * Validate thời gian có trong ca làm việc không
   * @param {Date} datetime 
   * @returns {boolean}
   */
  static isValidWorkingTime(datetime) {
    try {
      this.determineShift(datetime);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Format thời gian hiển thị theo giờ Việt Nam
   * @param {Date} startTime 
   * @param {Date} endTime 
   * @returns {string} - "08:00 - 09:00"
   */
  static formatTimeSlot(startTime, endTime) {
    const formatTime = (date) => {
      // Format theo timezone Việt Nam (UTC+7)
      const options = {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };
      
      const formatted = new Date(date).toLocaleString('vi-VN', options);
      // formatted = "HH:mm" hoặc "H:mm"
      return formatted;
    };

    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  }

  /**
   * Tính tổng số slot có thể tạo trong một khoảng thời gian
   * @param {Date} startTime 
   * @param {Date} endTime 
   * @param {Number} slotDurationMinutes - Thời lượng 1 slot
   * @param {Number} breakMinutes - Thời gian nghỉ
   * @returns {Number}
   */
  static calculateMaxSlots(startTime, endTime, slotDurationMinutes, breakMinutes = 10) {
    const totalMinutes = (endTime - startTime) / 60000;
    const slotWithBreak = slotDurationMinutes + breakMinutes;
    return Math.floor(totalMinutes / slotWithBreak);
  }

  /**
   * Generate simple time slots (chỉ startTime/endTime) cho một khoảng thời gian
   * Dùng cho generateAvailableSlotsByDate
   */
  static generateTimeSlots(params) {
    const {
      scheduleStart,
      scheduleEnd,
      serviceDuration,
      breakAfterMinutes = 10
    } = params;

    // Validate input
    if (!scheduleStart || !scheduleEnd) {
      throw new Error('Thiếu thông tin thời gian làm việc');
    }

    if (!serviceDuration || serviceDuration <= 0) {
      throw new Error('Thời lượng dịch vụ không hợp lệ');
    }

    const slots = [];
    let currentStartTime = new Date(scheduleStart);
    const endTime = new Date(scheduleEnd);

    // Tạo slots cho đến khi hết thời gian làm việc
    while (currentStartTime < endTime) {
      // Tính thời gian kết thúc của slot này (start + duration)
      const currentEndTime = new Date(currentStartTime.getTime() + serviceDuration * 60000);

      // Kiểm tra xem slot này có vượt quá thời gian làm việc không
      if (currentEndTime > endTime) {
        break;
      }

      // Tạo slot đơn giản (chỉ có thời gian)
      slots.push({
        startTime: new Date(currentStartTime),
        endTime: new Date(currentEndTime)
      });

      // Tính thời gian bắt đầu slot tiếp theo (end + break)
      currentStartTime = new Date(currentEndTime.getTime() + breakAfterMinutes * 60000);
    }

    return slots;
  }
}

module.exports = ScheduleHelper;
