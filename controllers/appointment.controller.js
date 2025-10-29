const appointmentService = require('../services/appointment.service');
const emailService = require('../services/email.service');
const Policy = require('../models/policy.model');
const Appointment = require('../models/appointment.model');
const availableSlotService = require('../services/availableSlot.service');

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
    
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách tất cả lịch hẹn thành công',
      data: appointments
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

    if (doctorSchedules.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          date,
          serviceName: appointment.serviceId.serviceName,
          doctorName: appointment.doctorUserId.fullName,
          availableSlots: [],
          totalSlots: 0,
          message: 'Bác sĩ không có lịch làm việc trong ngày này'
        },
      });
    }

    // Tạo slots dựa trên lịch làm việc thực tế của bác sĩ
    const allSlots = [];

    for (const schedule of doctorSchedules) {
      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);
      
      console.log(`📅 Processing schedule: ${schedule.shift} (${scheduleStart.toLocaleTimeString('vi-VN')} - ${scheduleEnd.toLocaleTimeString('vi-VN')})`);
      
      // Tạo slots trong khoảng thời gian làm việc
      let currentTime = new Date(scheduleStart);
      while (currentTime < scheduleEnd) {
        const slotEnd = new Date(currentTime.getTime() + serviceDuration * 60000);
        if (slotEnd <= scheduleEnd) {
          // Convert to Vietnam time (UTC+7) for display
          const vietnamStartTime = new Date(currentTime.getTime() + 7 * 60 * 60 * 1000);
          const vietnamEndTime = new Date(slotEnd.getTime() + 7 * 60 * 60 * 1000);
          
          allSlots.push({
            startTime: currentTime.toISOString(),
            endTime: slotEnd.toISOString(),
            displayTime: `${vietnamStartTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${vietnamEndTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
          });
        }
        currentTime = new Date(currentTime.getTime() + serviceDuration * 60000);
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

    return res.status(200).json({
      success: true,
      data: {
        date,
        serviceName: appointment.serviceId.serviceName,
        doctorName: appointment.doctorUserId.fullName,
        availableSlots: filtered,
        totalSlots: filtered.length,
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
    const doctorSchedule = await DoctorSchedule.findOne({
      doctorUserId: appointment.doctorUserId._id,
      date: newDate,
      isActive: true
    });

    if (!doctorSchedule) {
      return res.status(400).json({
        success: false,
        message: 'Bác sĩ không có lịch làm việc trong ngày này'
      });
    }

    // Kiểm tra timeslot có khớp không - tìm timeslot rảnh trong ngày
    const timeslot = await Timeslot.findOne({
      doctorScheduleId: doctorSchedule._id,
      startTime: newStart,
      endTime: newEnd,
      status: 'Available'
    });

    if (!timeslot) {
      return res.status(400).json({
        success: false,
        message: 'Khung giờ này không có sẵn hoặc đã được đặt. Vui lòng chọn khung giờ khác.'
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