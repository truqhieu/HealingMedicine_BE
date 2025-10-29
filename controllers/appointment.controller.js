const appointmentService = require('../services/appointment.service');
const emailService = require('../services/email.service');
const Policy = require('../models/policy.model');
const Appointment = require('../models/appointment.model');
const availableSlotService = require('../services/availableSlot.service');

// Helper function to calculate available time range for morning/afternoon shifts
function calculateAvailableTimeRange(availableSlots, shift, workingHours) {
  console.log(`🔍 Calculating ${shift} shift from ${availableSlots.length} available slots`);
  
  const slots = availableSlots.filter(slot => {
    const startTime = new Date(slot.startTime);
    // Convert UTC to Vietnam time for comparison
    const vietnamTime = new Date(startTime.getTime() + 7 * 60 * 60 * 1000);
    const hour = vietnamTime.getHours();
    
    console.log(`   Slot: ${slot.displayTime} (UTC: ${startTime.toISOString()}, VN: ${vietnamTime.toLocaleTimeString('vi-VN')})`);
    
    if (shift === 'morning') {
      return hour >= 8 && hour < 12;
    } else {
      return hour >= 14 && hour < 18;
    }
  });

  console.log(`📅 ${shift} shift: Found ${slots.length} slots`);

  if (slots.length === 0) {
    return {
      hasAvailable: false,
      startTime: null,
      endTime: null,
      message: shift === 'morning' ? 'Ca sáng đã hết chỗ' : 'Ca chiều đã hết chỗ'
    };
  }

  // Sort slots by start time
  slots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  
  // Lấy slot đầu tiên và cuối cùng
  const firstSlot = slots[0];
  const lastSlot = slots[slots.length - 1];
  
  const startTime = new Date(firstSlot.startTime);
  const endTime = new Date(lastSlot.endTime);
  
  console.log(`📅 ${shift} shift: First slot ${firstSlot.startTime} - ${firstSlot.endTime}`);
  console.log(`📅 ${shift} shift: Last slot ${lastSlot.startTime} - ${lastSlot.endTime}`);
  console.log(`📅 ${shift} shift: Final range ${startTime.toLocaleTimeString('vi-VN')} - ${endTime.toLocaleTimeString('vi-VN')}`);
  
  return {
    hasAvailable: true,
    startTime: startTime.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    }),
    endTime: endTime.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    }),
    message: shift === 'morning' ? 'Ca sáng có sẵn' : 'Ca chiều có sẵn'
  };
}

const createConsultationAppointment = async (req, res) => {
  try {
    const {
      phoneNumber,
      appointmentFor,
      serviceId,
      doctorUserId, 
      doctorScheduleId,
      selectedSlot,
      notes
    } = req.body;

    // fullName và email có thể không được gửi nếu appointmentFor là 'self'
    let { fullName, email } = req.body;

    console.log('🔍 DEBUG createConsultationAppointment:');
    console.log('   - req.user:', req.user);
    console.log('   - req.headers.authorization:', req.headers.authorization ? 'EXISTS' : 'MISSING');
    console.log('   - req.body:', {
      fullName,
      email,
      phoneNumber,
      appointmentFor,
      serviceId,
      doctorUserId,
      doctorScheduleId,
      selectedSlot
    });

    // Lấy thông tin user đã đăng nhập
    const userId = req.user?.userId;

    console.log('   - userId extracted:', userId);

    if (!userId) {
      console.error('❌ userId is missing!');
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để đặt lịch tư vấn'
      });
    }

    // Validation các trường bắt buộc từ form
    if (!serviceId || !doctorUserId || !doctorScheduleId || !selectedSlot) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin: dịch vụ, bác sĩ, lịch làm việc và khung giờ'
      });
    }

    // Validation selectedSlot
    if (!selectedSlot.startTime || !selectedSlot.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn khung giờ hợp lệ'
      });
    }

    // Nếu appointmentFor là 'other', cần fullName và email
    if (appointmentFor === 'other') {
      if (!fullName || !email) {
        return res.status(400).json({
          success: false,
          message: 'Khi đặt lịch cho người khác, vui lòng cung cấp họ tên và email'
        });
      }
    }

    // Nếu appointmentFor là 'self', lấy thông tin từ user đã đăng nhập
    if (appointmentFor === 'self') {
      const User = require('../models/user.model');
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
        success: false,
          message: 'Không tìm thấy thông tin người dùng'
        });
      }
      fullName = user.fullName;
      email = user.email;
    }

    console.log('   - Final fullName:', fullName);
    console.log('   - Final email:', email);

    // Gọi service để tạo appointment
    const result = await appointmentService.createConsultationAppointment({
      patientUserId: userId,
      fullName,
      email,
      phoneNumber,
      appointmentFor,
      serviceId,
      doctorUserId,
      doctorScheduleId,
      selectedSlot,
      notes
    });

    console.log('✅ Appointment created successfully:', result);

    return res.status(201).json({
      success: true,
      message: 'Đặt lịch tư vấn thành công',
      data: result
    });

  } catch (error) {
    console.error('❌ Error in createConsultationAppointment:', error);
    return res.status(500).json({
        success: false,
      message: 'Lỗi server khi tạo lịch tư vấn',
      error: error.message
    });
  }
};

const reviewAppointment = async (req, res) => {
  try {
    const { appointmentId, action, cancelReason } = req.body;

    if (!appointmentId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ID lịch hẹn và hành động'
      });
    }

    if (!['approve', 'cancel'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Hành động không hợp lệ. Chỉ chấp nhận: approve, cancel'
      });
    }

    if (action === 'cancel' && !cancelReason) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp lý do hủy lịch'
      });
    }

    const result = await appointmentService.reviewAppointment({
      appointmentId,
      action,
      cancelReason
    });

    return res.status(200).json({
      success: true,
      message: action === 'approve' ? 'Duyệt lịch hẹn thành công' : 'Hủy lịch hẹn thành công',
      data: result
    });

  } catch (error) {
    console.error('❌ Error in reviewAppointment:', error);
    return res.status(500).json({
        success: false,
      message: 'Lỗi server khi xử lý lịch hẹn',
      error: error.message
    });
  }
};

const getPendingAppointments = async (req, res) => {
  try {
    const appointments = await appointmentService.getPendingAppointments();
    
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách lịch hẹn chờ duyệt thành công',
      data: appointments
    });

  } catch (error) {
    console.error('❌ Error in getPendingAppointments:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách lịch hẹn chờ duyệt',
      error: error.message
    });
  }
};

const getAllAppointments = async (req, res) => {
  try {
    const { status, startDate, endDate, doctorId, serviceId, page = 1, limit = 10 } = req.query;
    
    const appointments = await appointmentService.getAllAppointments({
      status,
      startDate,
      endDate,
      doctorId,
      serviceId,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    console.log('📋 getAllAppointments response:', {
      success: appointments.success,
      dataType: Array.isArray(appointments.data) ? 'array' : typeof appointments.data,
      dataLength: appointments.data?.length || 0
    });
    
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách tất cả lịch hẹn thành công',
      data: appointments.data || appointments
    });

  } catch (error) {
    console.error('❌ Error in getAllAppointments:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách lịch hẹn',
      error: error.message
    });
  }
};

const getMyAppointments = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { includePendingPayment, status } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để xem lịch hẹn'
      });
    }

    const appointments = await appointmentService.getUserAppointments(
      userId,
      {
        includePendingPayment: includePendingPayment === 'true',
        status,
      }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách lịch hẹn của bạn thành công',
      data: appointments
    });

  } catch (error) {
    console.error('❌ Error in getMyAppointments:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách lịch hẹn',
      error: error.message
    });
  }
};

const updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;

    if (!appointmentId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ID lịch hẹn và trạng thái mới'
      });
    }

    if (!['CheckedIn', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ. Chỉ chấp nhận: CheckedIn, Completed, Cancelled'
      });
    }

    const result = await appointmentService.updateAppointmentStatus({
      appointmentId,
      status
    });

    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái lịch hẹn thành công',
      data: result
    });

  } catch (error) {
    console.error('❌ Error in updateAppointmentStatus:', error);
    return res.status(500).json({
        success: false,
      message: 'Lỗi server khi cập nhật trạng thái lịch hẹn',
      error: error.message
    });
  }
};

const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { cancelReason } = req.body;
    const userId = req.user?.userId;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ID lịch hẹn'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để hủy lịch hẹn'
      });
    }

    const result = await appointmentService.cancelAppointment({
      appointmentId,
      userId,
      cancelReason
    });

    return res.status(200).json({
        success: true,
      message: 'Hủy lịch hẹn thành công',
        data: result
      });

  } catch (error) {
    console.error('❌ Error in cancelAppointment:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi hủy lịch hẹn',
      error: error.message
    });
  }
};

const confirmCancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { confirmed, cancelReason, bankInfo } = req.body;
    const userId = req.user?.userId;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ID lịch hẹn'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để xác nhận hủy lịch hẹn'
      });
    }

    if (confirmed === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng xác nhận có muốn hủy lịch hẹn không'
      });
    }

    const result = await appointmentService.confirmCancelAppointment({
      appointmentId,
      userId,
      confirmed,
      cancelReason,
      bankInfo
    });

    return res.status(200).json({
        success: true,
      message: confirmed ? 'Xác nhận hủy lịch hẹn thành công' : 'Đã hủy thao tác hủy lịch hẹn',
        data: result
      });

  } catch (error) {
    console.error('❌ Error in confirmCancelAppointment:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xác nhận hủy lịch hẹn',
      error: error.message
    });
  }
};

const getAppointmentDetails = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ID lịch hẹn'
      });
    }

    const appointment = await appointmentService.getAppointmentDetails(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết lịch hẹn thành công',
      data: appointment
    });

  } catch (error) {
    console.error('❌ Error in getAppointmentDetails:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết lịch hẹn',
      error: error.message
    });
  }
};

const markAsRefunded = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ID lịch hẹn'
      });
    }

    const result = await appointmentService.markAsRefunded(appointmentId);

    return res.status(200).json({
      success: true,
      message: 'Đánh dấu đã hoàn tiền thành công',
      data: result
    });

  } catch (error) {
    console.error('❌ Error in markAsRefunded:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi đánh dấu đã hoàn tiền',
      error: error.message
    });
  }
};

// ⭐ Lấy danh sách khung giờ rảnh dùng cho đổi lịch hẹn (theo appointmentId)
const getRescheduleAvailableSlots = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { date } = req.query; // YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ngày (YYYY-MM-DD)' });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate('serviceId', 'serviceName durationMinutes')
      .populate('doctorUserId', 'fullName');

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
    }

    // Kiểm tra lịch làm việc của bác sĩ trong ngày đó
    const DoctorSchedule = require('../models/doctorSchedule.model');
    const serviceDuration = appointment.serviceId.durationMinutes || 30;
    const searchDate = new Date(date);
    searchDate.setHours(0, 0, 0, 0);

    // Tìm lịch làm việc của bác sĩ trong ngày
    const doctorSchedules = await DoctorSchedule.find({
      doctorUserId: appointment.doctorUserId._id,
      date: searchDate,
      status: 'Available'
    }).sort({ startTime: 1 });

    let workingHours;
    let hasDoctorSchedule = false;

    if (doctorSchedules.length === 0) {
      // Nếu không có doctorSchedule, sử dụng workingHours mặc định
      // Lấy workingHours từ bác sĩ hoặc sử dụng mặc định
      const Doctor = require('../models/doctor.model');
      const doctor = await Doctor.findOne({ userId: appointment.doctorUserId._id });
      
      if (doctor && doctor.workingHours) {
        workingHours = doctor.workingHours;
      } else {
        // Sử dụng workingHours mặc định nếu không có
        workingHours = {
          morningStart: '08:00',
          morningEnd: '12:00',
          afternoonStart: '14:00',
          afternoonEnd: '18:00'
        };
      }
      
      console.log('📅 No doctorSchedule found, using default workingHours:', workingHours);
    } else {
      // Sử dụng workingHours từ DoctorSchedule đầu tiên
      workingHours = doctorSchedules[0].workingHours || {
        morningStart: '08:00',
        morningEnd: '12:00',
        afternoonStart: '14:00',
        afternoonEnd: '18:00'
      };
      hasDoctorSchedule = true;
    }

    // Tạo slots dựa trên workingHours từ DoctorSchedule
    const allSlots = [];

    // Tạo slots cho ca sáng
    if (workingHours.morningStart && workingHours.morningEnd) {
      const morningStart = new Date(searchDate);
      const [morningStartHour, morningStartMinute] = workingHours.morningStart.split(':').map(Number);
      morningStart.setUTCHours(morningStartHour - 7, morningStartMinute, 0, 0); // Convert VN time to UTC

      const morningEnd = new Date(searchDate);
      const [morningEndHour, morningEndMinute] = workingHours.morningEnd.split(':').map(Number);
      morningEnd.setUTCHours(morningEndHour - 7, morningEndMinute, 0, 0); // Convert VN time to UTC

      const breakAfterMinutes = 10;
      let currentTime = new Date(morningStart);
      
      while (currentTime < morningEnd) {
        const slotEnd = new Date(currentTime.getTime() + serviceDuration * 60000);
        if (slotEnd <= morningEnd) {
          // Convert to Vietnam time (UTC+7) for display
          const vietnamStartTime = new Date(currentTime.getTime() + 7 * 60 * 60 * 1000);
          const vietnamEndTime = new Date(slotEnd.getTime() + 7 * 60 * 60 * 1000);
          
          allSlots.push({
            startTime: currentTime.toISOString(),
            endTime: slotEnd.toISOString(),
            displayTime: `${vietnamStartTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${vietnamEndTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
          });
        }
        currentTime = new Date(slotEnd.getTime() + breakAfterMinutes * 60000);
      }
    }

    // Tạo slots cho ca chiều
    if (workingHours.afternoonStart && workingHours.afternoonEnd) {
      const afternoonStart = new Date(searchDate);
      const [afternoonStartHour, afternoonStartMinute] = workingHours.afternoonStart.split(':').map(Number);
      afternoonStart.setUTCHours(afternoonStartHour - 7, afternoonStartMinute, 0, 0); // Convert VN time to UTC

      const afternoonEnd = new Date(searchDate);
      const [afternoonEndHour, afternoonEndMinute] = workingHours.afternoonEnd.split(':').map(Number);
      afternoonEnd.setUTCHours(afternoonEndHour - 7, afternoonEndMinute, 0, 0); // Convert VN time to UTC

      const breakAfterMinutes = 10;
      let currentTime = new Date(afternoonStart);
      
      while (currentTime < afternoonEnd) {
        const slotEnd = new Date(currentTime.getTime() + serviceDuration * 60000);
        if (slotEnd <= afternoonEnd) {
          // Convert to Vietnam time (UTC+7) for display
          const vietnamStartTime = new Date(currentTime.getTime() + 7 * 60 * 60 * 1000);
          const vietnamEndTime = new Date(slotEnd.getTime() + 7 * 60 * 60 * 1000);
          
          allSlots.push({
            startTime: currentTime.toISOString(),
            endTime: slotEnd.toISOString(),
            displayTime: `${vietnamStartTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${vietnamEndTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
          });
        }
        currentTime = new Date(slotEnd.getTime() + breakAfterMinutes * 60000);
      }
    }

    // Debug: Log tất cả slots được tạo
    console.log(`📅 Generated ${allSlots.length} slots for date ${date}`);
    allSlots.forEach((slot, index) => {
      console.log(`   Slot ${index + 1}: ${slot.displayTime}`);
    });

    // Lọc bỏ các slots đã được đặt
    const Timeslot = require('../models/timeslot.model');
    const existingTimeslots = await Timeslot.find({
      doctorUserId: appointment.doctorUserId._id,
      startTime: { 
        $gte: new Date(searchDate).setHours(0, 0, 0, 0),
        $lt: new Date(searchDate).setHours(23, 59, 59, 999)
      },
      status: { $in: ['Reserved', 'Booked'] }
    });

    console.log(`🔴 Found ${existingTimeslots.length} existing timeslots for this doctor on ${date}`);

    const bookedSlots = existingTimeslots.map(ts => ({
      start: new Date(ts.startTime),
      end: new Date(ts.endTime)
    }));

    // Debug: Log booked slots
    bookedSlots.forEach((booked, index) => {
      console.log(`   Booked ${index + 1}: ${booked.start.toLocaleTimeString('vi-VN')} - ${booked.end.toLocaleTimeString('vi-VN')}`);
    });

    const availableSlots = allSlots.filter(slot => {
      const slotStart = new Date(slot.startTime);
      const slotEnd = new Date(slot.endTime);
      
      const isBooked = bookedSlots.some(booked => {
        return (slotStart >= booked.start && slotStart < booked.end) ||
               (slotEnd > booked.start && slotEnd <= booked.end) ||
               (slotStart <= booked.start && slotEnd >= booked.end);
      });
      
      if (isBooked) {
        console.log(`   ❌ Slot ${slot.displayTime} is booked`);
      }
      
      return !isBooked;
    });

    console.log(`✅ Final available slots: ${availableSlots.length}`);

    // Ẩn giờ đã qua nếu là hôm nay
    const todayStr = new Date().toISOString().split('T')[0];
    let filtered = availableSlots;
    if (date === todayStr) {
      const now = new Date();
      filtered = availableSlots.filter((s) => new Date(s.startTime) > now);
    }

    // Tính toán thời gian khả dụng theo ca sáng và chiều
    const morningAvailable = calculateAvailableTimeRange(filtered, 'morning', workingHours);
    const afternoonAvailable = calculateAvailableTimeRange(filtered, 'afternoon', workingHours);

    return res.status(200).json({
      success: true,
      data: {
        date,
        serviceName: appointment.serviceId.serviceName,
        serviceDuration: appointment.serviceId.durationMinutes,
        doctorName: appointment.doctorUserId.fullName,
        availableSlots: filtered,
        totalSlots: filtered.length,
        hasDoctorSchedule: hasDoctorSchedule,
        message: hasDoctorSchedule 
          ? 'Các khung giờ có sẵn từ lịch làm việc của bác sĩ'
          : 'Các khung giờ được tạo từ giờ làm việc mặc định của bác sĩ',
        morningAvailable: morningAvailable,
        afternoonAvailable: afternoonAvailable
      },
    });
  } catch (error) {
    console.error('❌ Error in getRescheduleAvailableSlots:', error);
    return res.status(500).json({ success: false, message: 'Lỗi khi lấy khung giờ rảnh', error: error.message });
  }
};

// ⭐ Bệnh nhân gửi yêu cầu đổi lịch hẹn (chỉ đổi ngày/giờ)
const requestReschedule = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newStartTime, newEndTime } = req.body;
    const userId = req.user?.userId;

    console.log('🔍 DEBUG requestReschedule:');
    console.log('   - appointmentId:', appointmentId);
    console.log('   - userId:', userId);
    console.log('   - newStartTime:', newStartTime);
    console.log('   - newEndTime:', newEndTime);

    // Validation
    if (!newStartTime || !newEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp thời gian bắt đầu và kết thúc mới'
      });
    }

    const newStart = new Date(newStartTime);
    const newEnd = new Date(newEndTime);

    if (newStart >= newEnd) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian bắt đầu phải nhỏ hơn thời gian kết thúc'
      });
    }

    if (newStart <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian mới phải trong tương lai'
      });
    }

    // Tìm appointment và kiểm tra quyền sở hữu
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientUserId', 'fullName email')
      .populate('doctorUserId', 'fullName email')
      .populate('serviceId', 'serviceName')
      .populate('timeslotId');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Lưu thông tin cũ trước khi cập nhật
    const oldStartTime = appointment.timeslotId ? appointment.timeslotId.startTime : null;
    const oldEndTime = appointment.timeslotId ? appointment.timeslotId.endTime : null;

    // Kiểm tra quyền sở hữu
    if (appointment.patientUserId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thay đổi lịch hẹn này'
      });
    }

    // Kiểm tra trạng thái cho phép đổi lịch
    if (!['Pending', 'Approved'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể đổi lịch khi trạng thái là Chờ duyệt hoặc Đã xác nhận'
      });
    }

    // Kiểm tra bác sĩ có rảnh trong khung giờ mới không
    const DoctorSchedule = require('../models/doctorSchedule.model');
    const Timeslot = require('../models/timeslot.model');
    
    // Tìm lịch làm việc của bác sĩ trong ngày mới
    const newDate = newStart.toISOString().split('T')[0];
    const selectedHour = newStart.getHours();
    const shift = selectedHour < 12 ? 'Morning' : 'Afternoon';
    
    let doctorSchedule = await DoctorSchedule.findOne({
      doctorUserId: appointment.doctorUserId._id,
      date: newDate,
      shift: shift,
      status: 'Available'
    });

    // Nếu không có doctorSchedule, tạo mới dựa trên workingHours của bác sĩ
    if (!doctorSchedule) {
      console.log('📅 No doctorSchedule found, creating new ones for date:', newDate);
      
      // Lấy workingHours từ bác sĩ
      const Doctor = require('../models/doctor.model');
      const doctor = await Doctor.findOne({ userId: appointment.doctorUserId._id });
      
      let workingHours;
      if (doctor && doctor.workingHours) {
        workingHours = doctor.workingHours;
      } else {
        // Sử dụng workingHours mặc định
        workingHours = {
          morningStart: '08:00',
          morningEnd: '12:00',
          afternoonStart: '14:00',
          afternoonEnd: '18:00'
        };
      }

      // Tạo doctorSchedule cho ca phù hợp
      doctorSchedule = new DoctorSchedule({
        doctorUserId: appointment.doctorUserId._id,
        date: new Date(newDate),
        shift: shift,
        maxSlots: 20, // Số slot tối đa cho ca
        workingHours: workingHours,
        status: 'Available',
        createdBy: userId || appointment.doctorUserId._id
      });

      await doctorSchedule.save();
      console.log('✅ Created new doctorSchedule:', doctorSchedule._id, 'for shift:', shift);
    }

    // Kiểm tra timeslot có khớp không - tìm timeslot rảnh trong ngày
    let timeslot = await Timeslot.findOne({
      doctorScheduleId: doctorSchedule._id,
      startTime: newStart,
      endTime: newEnd,
      status: 'Available'
    });

    // Nếu không tìm thấy timeslot, tạo mới
    if (!timeslot) {
      console.log('📅 No timeslot found, creating new one for time:', newStart, '-', newEnd);
      
      timeslot = new Timeslot({
        doctorScheduleId: doctorSchedule._id,
        doctorUserId: appointment.doctorUserId._id,
        startTime: newStart,
        endTime: newEnd,
        status: 'Available',
        createdBy: userId || appointment.doctorUserId._id
      });

      await timeslot.save();
      console.log('✅ Created new timeslot:', timeslot._id);
    }

    // Kiểm tra xem có appointment nào khác đã đặt timeslot này chưa
    const existingAppointment = await Appointment.findOne({
      timeslotId: timeslot._id,
      status: { $nin: ['Cancelled', 'Expired'] },
      _id: { $ne: appointmentId }
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: 'Khung giờ này đã được đặt bởi bệnh nhân khác'
      });
    }

    // Cập nhật appointment với thông tin mới
    appointment.timeslotId = timeslot._id;
    appointment.status = 'Pending'; // Reset về chờ duyệt
    await appointment.save();

    // Không gửi email thông báo theo yêu cầu

    console.log('✅ Reschedule request successful');
    return res.status(200).json({
      success: true,
      message: 'Yêu cầu đổi lịch đã được gửi thành công',
      data: {
        appointmentId: appointment._id,
        newStartTime: newStartTime,
        newEndTime: newEndTime,
        status: 'Pending'
      }
    });

  } catch (error) {
    console.error('❌ Error in requestReschedule:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xử lý yêu cầu đổi lịch',
      error: error.message
    });
  }
};

// ⭐ Bệnh nhân gửi yêu cầu đổi bác sĩ (chỉ đổi bác sĩ)
const requestChangeDoctor = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newDoctorUserId } = req.body;
    const userId = req.user?.userId;
    
    console.log('🔍 DEBUG requestChangeDoctor:');
    console.log('   - appointmentId:', appointmentId);
    console.log('   - userId:', userId);
    console.log('   - newDoctorUserId:', newDoctorUserId);

    // Validation
    if (!newDoctorUserId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ID bác sĩ mới'
      });
    }

    // Tìm appointment và kiểm tra quyền sở hữu
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientUserId', 'fullName email')
      .populate('doctorUserId', 'fullName email')
      .populate('serviceId', 'serviceName')
      .populate('timeslotId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Lưu thông tin cũ trước khi cập nhật
    const oldDoctorName = appointment.doctorUserId.fullName;

    // Kiểm tra quyền sở hữu
    if (appointment.patientUserId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thay đổi lịch hẹn này'
      });
    }

    // Kiểm tra trạng thái cho phép đổi bác sĩ
    if (!['Pending', 'Approved'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể đổi bác sĩ khi trạng thái là Chờ duyệt hoặc Đã xác nhận'
      });
    }

    // Kiểm tra bác sĩ mới có tồn tại không
    const User = require('../models/user.model');
    const newDoctor = await User.findById(newDoctorUserId);
    
    if (!newDoctor || newDoctor.role !== 'Doctor') {
      return res.status(400).json({
        success: false,
        message: 'Bác sĩ không tồn tại hoặc không hợp lệ'
      });
    }

    // Kiểm tra bác sĩ mới có khác bác sĩ cũ không
    if (appointment.doctorUserId._id.toString() === newDoctorUserId) {
      return res.status(400).json({
      success: false,
        message: 'Bác sĩ mới phải khác bác sĩ hiện tại'
      });
    }

    // Kiểm tra bác sĩ mới có rảnh trong khung giờ hiện tại không
    const DoctorSchedule = require('../models/doctorSchedule.model');
    const Timeslot = require('../models/timeslot.model');
    
    const currentDate = new Date(appointment.timeslotId.startTime).toISOString().split('T')[0];
    const doctorSchedule = await DoctorSchedule.findOne({
      doctorUserId: newDoctorUserId,
      date: currentDate,
      isActive: true
    });

    if (!doctorSchedule) {
      return res.status(400).json({
        success: false,
        message: 'Bác sĩ mới không có lịch làm việc trong ngày này'
      });
    }

    // Kiểm tra timeslot có khớp không - tìm timeslot rảnh trong khung giờ hiện tại
    const timeslot = await Timeslot.findOne({
      doctorScheduleId: doctorSchedule._id,
      startTime: appointment.timeslotId.startTime,
      endTime: appointment.timeslotId.endTime,
      status: 'Available'
    });

    if (!timeslot) {
      return res.status(400).json({
      success: false,
        message: 'Bác sĩ mới không có khung giờ rảnh trong thời gian này. Vui lòng chọn bác sĩ khác hoặc đổi lịch hẹn.'
      });
    }

    // Kiểm tra xem có appointment nào khác đã đặt timeslot này chưa
    const existingAppointment = await Appointment.findOne({
      timeslotId: timeslot._id,
      status: { $nin: ['Cancelled', 'Expired'] },
      _id: { $ne: appointmentId }
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: 'Khung giờ này đã được đặt bởi bệnh nhân khác'
      });
    }

    // Cập nhật appointment với bác sĩ mới
    appointment.doctorUserId = newDoctorUserId;
    appointment.timeslotId = timeslot._id;
    appointment.status = 'Pending'; // Reset về chờ duyệt
    await appointment.save();

    // Không gửi email thông báo theo yêu cầu

    console.log('✅ Change doctor request successful');
    return res.status(200).json({
      success: true,
      message: 'Yêu cầu đổi bác sĩ đã được gửi thành công',
      data: {
        appointmentId: appointment._id,
        newDoctorUserId: newDoctorUserId,
        newDoctorName: newDoctor.fullName,
        status: 'Pending'
      }
    });

  } catch (error) {
    console.error('❌ Error in requestChangeDoctor:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi xử lý yêu cầu đổi bác sĩ',
      error: error.message
    });
  }
};

module.exports = {
  createConsultationAppointment,
  reviewAppointment,
  getPendingAppointments,
  getAllAppointments,
  getMyAppointments,
  updateAppointmentStatus,
  cancelAppointment,
  confirmCancelAppointment,
  getAppointmentDetails,
  markAsRefunded,
  requestReschedule,
  requestChangeDoctor,
  getRescheduleAvailableSlots
};
