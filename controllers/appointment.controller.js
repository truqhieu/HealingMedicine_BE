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
  
  // Convert UTC to Vietnam time for display
  const vnStartTime = new Date(startTime.getTime() + 7 * 60 * 60 * 1000);
  const vnEndTime = new Date(endTime.getTime() + 7 * 60 * 60 * 1000);
  
  return {
    hasAvailable: true,
    startTime: vnStartTime.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    }),
    endTime: vnEndTime.toLocaleTimeString('vi-VN', { 
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
          // Tạo displayTime bằng cách chuyển đổi UTC sang VN time
          const vnStartTime = new Date(currentTime.getTime() + 7 * 60 * 60 * 1000);
          const vnEndTime = new Date(slotEnd.getTime() + 7 * 60 * 60 * 1000);
          
          allSlots.push({
            startTime: currentTime.toISOString(),
            endTime: slotEnd.toISOString(),
            displayTime: `${vnStartTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${vnEndTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
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
          // Tạo displayTime bằng cách chuyển đổi UTC sang VN time
          const vnStartTime = new Date(currentTime.getTime() + 7 * 60 * 60 * 1000);
          const vnEndTime = new Date(slotEnd.getTime() + 7 * 60 * 60 * 1000);
          
          allSlots.push({
            startTime: currentTime.toISOString(),
            endTime: slotEnd.toISOString(),
            displayTime: `${vnStartTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${vnEndTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
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
    
    // Tạo date range chính xác cho ngày được chọn
    const startOfDay = new Date(searchDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    
    const endOfDay = new Date(searchDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    
    const existingTimeslots = await Timeslot.find({
      doctorUserId: appointment.doctorUserId._id,
      startTime: { 
        $gte: startOfDay,
        $lt: endOfDay
      },
      status: { $in: ['Reserved', 'Booked'] }
    });

    console.log(`🔴 Found ${existingTimeslots.length} existing timeslots for this doctor on ${date}`);
    console.log(`🔍 Date range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

    const bookedSlots = existingTimeslots.map(ts => ({
      start: new Date(ts.startTime),
      end: new Date(ts.endTime)
    }));

    // Debug: Log booked slots
    bookedSlots.forEach((booked, index) => {
      const vnStart = new Date(booked.start.getTime() + 7 * 60 * 60 * 1000);
      const vnEnd = new Date(booked.end.getTime() + 7 * 60 * 60 * 1000);
      console.log(`   Booked ${index + 1}: ${vnStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${vnEnd.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}`);
    });

    const availableSlots = allSlots.filter(slot => {
      const slotStart = new Date(slot.startTime);
      const slotEnd = new Date(slot.endTime);
      
      const isBooked = bookedSlots.some(booked => {
        const overlap = (slotStart >= booked.start && slotStart < booked.end) ||
               (slotEnd > booked.start && slotEnd <= booked.end) ||
               (slotStart <= booked.start && slotEnd >= booked.end);
        
        if (overlap) {
          console.log(`   ❌ Slot ${slot.displayTime} overlaps with booked slot ${booked.start.toISOString()} - ${booked.end.toISOString()}`);
        }
        
        return overlap;
      });
      
      if (isBooked) {
        console.log(`   ❌ Slot ${slot.displayTime} is booked`);
      } else {
        console.log(`   ✅ Slot ${slot.displayTime} is available`);
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
    const { newStartTime, newEndTime, reason } = req.body;
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

    // Kiểm tra xem đã có request pending chưa
    const PatientRequest = require('../models/patientRequest.model');
    const existingRequest = await PatientRequest.findOne({
      appointmentId,
      requestType: 'Reschedule',
      status: 'Pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Đã có yêu cầu đổi lịch đang chờ xử lý'
      });
    }

    // Kiểm tra xem thời gian yêu cầu có khả dụng không
    // Sử dụng logic tương tự như getRescheduleAvailableSlots
    const DoctorSchedule = require('../models/doctorSchedule.model');
    const Timeslot = require('../models/timeslot.model');
    
    // Lấy lịch làm việc của bác sĩ
    const doctorSchedule = await DoctorSchedule.findOne({
      doctorUserId: appointment.doctorUserId._id,
      isActive: true
    });

    let workingHours = {
      morningStart: 8, morningEnd: 12,
      afternoonStart: 13, afternoonEnd: 17
    };

    if (doctorSchedule) {
      workingHours = {
        morningStart: doctorSchedule.morningStartHour,
        morningEnd: doctorSchedule.morningEndHour,
        afternoonStart: doctorSchedule.afternoonStartHour,
        afternoonEnd: doctorSchedule.afternoonEndHour
      };
    }

    // Kiểm tra thời gian yêu cầu có nằm trong giờ làm việc không
    const requestDate = new Date(newStart);
    const requestHour = requestDate.getUTCHours();
    const requestMinute = requestDate.getUTCMinutes();
    
    const isInMorning = requestHour >= workingHours.morningStart && 
                       (requestHour < workingHours.morningEnd || 
                        (requestHour === workingHours.morningEnd && requestMinute === 0));
    const isInAfternoon = requestHour >= workingHours.afternoonStart && 
                          (requestHour < workingHours.afternoonEnd || 
                           (requestHour === workingHours.afternoonEnd && requestMinute === 0));

    if (!isInMorning && !isInAfternoon) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian yêu cầu không nằm trong giờ làm việc của bác sĩ'
      });
    }

    // Kiểm tra xem có bị trùng với lịch hẹn khác không
    const existingAppointments = await Appointment.find({
      doctorUserId: appointment.doctorUserId._id,
      _id: { $ne: appointmentId },
      status: { $in: ['Pending', 'Approved', 'CheckedIn'] }
    }).populate('timeslotId');

    const hasConflict = existingAppointments.some(apt => {
      if (!apt.timeslotId) return false;
      const aptStart = new Date(apt.timeslotId.startTime);
      const aptEnd = new Date(apt.timeslotId.endTime);
      
      return (newStart < aptEnd && newEnd > aptStart);
    });

    if (hasConflict) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian yêu cầu bị trùng với lịch hẹn khác'
      });
    }

    // Tạo PatientRequest
    const request = new PatientRequest({
      appointmentId,
      patientUserId: userId,
      requestType: 'Reschedule',
      currentData: {
        doctorUserId: appointment.doctorUserId._id,
        timeslotId: appointment.timeslotId._id,
        startTime: appointment.timeslotId.startTime,
        endTime: appointment.timeslotId.endTime
      },
      requestedData: {
        startTime: newStart,
        endTime: newEnd,
        reason: reason || 'Yêu cầu đổi lịch hẹn'
      }
    });

    await request.save();

    console.log('✅ Reschedule request created successfully');
    return res.status(201).json({
      success: true,
      message: 'Yêu cầu đổi lịch đã được gửi thành công',
      data: {
        requestId: request._id,
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
    const { newDoctorUserId, reason } = req.body;
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

    // Kiểm tra xem đã có request pending chưa
    const PatientRequest = require('../models/patientRequest.model');
    const existingRequest = await PatientRequest.findOne({
      appointmentId,
      requestType: 'ChangeDoctor',
      status: 'Pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Đã có yêu cầu đổi bác sĩ đang chờ xử lý'
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

    // Tạo PatientRequest
    const request = new PatientRequest({
      appointmentId,
      patientUserId: userId,
      requestType: 'ChangeDoctor',
      currentData: {
        doctorUserId: appointment.doctorUserId._id,
        timeslotId: appointment.timeslotId._id,
        startTime: appointment.timeslotId.startTime,
        endTime: appointment.timeslotId.endTime
      },
      requestedData: {
      doctorUserId: newDoctorUserId,
        reason: reason || 'Yêu cầu đổi bác sĩ'
      }
    });

    await request.save();

    console.log('✅ Change doctor request created successfully');
    return res.status(201).json({
      success: true,
      message: 'Yêu cầu đổi bác sĩ đã được gửi thành công',
      data: {
        requestId: request._id,
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

// ⭐ Lấy danh sách bác sĩ khả dụng cho thời gian cụ thể (dùng cho đổi bác sĩ)
const getAvailableDoctorsForTimeSlot = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { startTime, endTime } = req.query;

    console.log('🔍 DEBUG getAvailableDoctorsForTimeSlot:');
    console.log('   - appointmentId:', appointmentId);
    console.log('   - startTime:', startTime);
    console.log('   - endTime:', endTime);

    // Validation
    if (!startTime || !endTime) {
      return res.status(400).json({
      success: false,
        message: 'Vui lòng cung cấp thời gian bắt đầu và kết thúc'
      });
    }

    // Tìm appointment để lấy thông tin dịch vụ
    const appointment = await Appointment.findById(appointmentId)
      .populate('serviceId', 'serviceName durationMinutes')
      .populate('doctorUserId', 'fullName');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);
    const serviceDuration = appointment.serviceId.durationMinutes || 30;

    console.log(`🔍 Looking for doctors available from ${startDateTime.toISOString()} to ${endDateTime.toISOString()}`);

    // Lấy tất cả bác sĩ ACTIVE
    const User = require('../models/user.model');
    const Doctor = require('../models/doctor.model');
    const Timeslot = require('../models/timeslot.model');

    const doctors = await User.find({
      role: 'Doctor',
      status: 'Active'
    }).select('_id fullName email');

    console.log(`🔍 Found ${doctors.length} active doctors`);

    const availableDoctors = [];

    for (const doctor of doctors) {
      // Bỏ qua bác sĩ hiện tại
      if (doctor._id.toString() === appointment.doctorUserId._id.toString()) {
        continue;
      }

      // Kiểm tra xem bác sĩ có lịch làm việc trong thời gian này không
      const DoctorSchedule = require('../models/doctorSchedule.model');
      const doctorSchedule = await DoctorSchedule.findOne({
        doctorUserId: doctor._id,
        date: {
          $gte: new Date(startDateTime.getFullYear(), startDateTime.getMonth(), startDateTime.getDate()),
          $lt: new Date(startDateTime.getFullYear(), startDateTime.getMonth(), startDateTime.getDate() + 1)
        },
        status: 'Available'
      });

      if (!doctorSchedule) {
        console.log(`   ❌ Doctor ${doctor.fullName} has no schedule for this date`);
        continue;
      }

      // Kiểm tra xem bác sĩ có rảnh trong khoảng thời gian này không
      const conflictingTimeslots = await Timeslot.find({
        doctorUserId: doctor._id,
        startTime: { $lt: endDateTime },
        endTime: { $gt: startDateTime },
        status: { $in: ['Reserved', 'Booked'] }
      });

      if (conflictingTimeslots.length > 0) {
        console.log(`   ❌ Doctor ${doctor.fullName} has ${conflictingTimeslots.length} conflicting appointments`);
        continue;
      }

      // Kiểm tra xem bác sĩ có appointments trong khoảng thời gian này không
      const conflictingAppointments = await Appointment.find({
        doctorUserId: doctor._id,
        'timeslotId.startTime': { $lt: endDateTime },
        'timeslotId.endTime': { $gt: startDateTime },
        status: { $in: ['Approved', 'CheckedIn', 'Completed'] }
      }).populate('timeslotId');

      if (conflictingAppointments.length > 0) {
        console.log(`   ❌ Doctor ${doctor.fullName} has ${conflictingAppointments.length} conflicting appointments`);
        continue;
      }

      // Kiểm tra working hours
      const workingHours = doctorSchedule.workingHours || {
        morningStart: '08:00',
        morningEnd: '12:00',
        afternoonStart: '14:00',
        afternoonEnd: '18:00'
      };

      const startHour = startDateTime.getUTCHours() + 7; // Convert to VN time
      const endHour = endDateTime.getUTCHours() + 7;

      const isInMorningShift = startHour >= 8 && endHour <= 12;
      const isInAfternoonShift = startHour >= 14 && endHour <= 18;

      if (!isInMorningShift && !isInAfternoonShift) {
        console.log(`   ❌ Doctor ${doctor.fullName} - time slot outside working hours`);
        continue;
      }

      availableDoctors.push({
        _id: doctor._id,
        fullName: doctor.fullName,
        email: doctor.email,
        workingHours: workingHours
      });

      console.log(`   ✅ Doctor ${doctor.fullName} is available`);
    }

    console.log(`✅ Found ${availableDoctors.length} available doctors`);

    return res.status(200).json({
      success: true,
      data: {
        appointmentId,
        currentDoctor: {
          _id: appointment.doctorUserId._id,
          fullName: appointment.doctorUserId.fullName
        },
        serviceName: appointment.serviceId.serviceName,
        serviceDuration,
        requestedStartTime: startTime,
        requestedEndTime: endTime,
        availableDoctors,
        totalAvailable: availableDoctors.length
      }
    });

  } catch (error) {
    console.error('❌ Error in getAvailableDoctorsForTimeSlot:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách bác sĩ khả dụng',
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
  getRescheduleAvailableSlots,
  getAvailableDoctorsForTimeSlot
};
