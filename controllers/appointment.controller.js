const appointmentService = require('../services/appointment.service');
const emailService = require('../services/email.service');
const Policy = require('../models/policy.model');

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
        message: 'Vui lòng chọn đầy đủ dịch vụ tư vấn, bác sĩ và khung giờ'
      });
    }

    if (!selectedSlot.startTime || !selectedSlot.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin khung giờ không hợp lệ'
      });
    }

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập số điện thoại'
      });
    }

    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại không hợp lệ (phải là 10-11 số)'
      });
    }

    // Nếu đặt cho người khác (customer), bắt buộc nhập đầy đủ họ tên và email
    if (appointmentFor === 'other') {
      if (!fullName || !email) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ họ tên và email của người được đặt lịch (customer)'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Email của customer không đúng định dạng'
        });
      }
    }

    // Tạo appointment data
    const appointmentData = {
      patientUserId: userId, 
      doctorUserId: doctorUserId, 
      serviceId: serviceId,
      doctorScheduleId: doctorScheduleId,
      selectedSlot: selectedSlot, 
      notes: notes || null,
      formData: {
        fullName: fullName || '',
        email: email || '',
        phoneNumber,
        appointmentFor: appointmentFor || 'self'
      }
    };

    const appointment = await appointmentService.createConsultationAppointment(appointmentData);

    let emailRecipient, recipientName;
    
    if (appointment.customerId) {
      // Nếu có customerId = đặt cho người khác → gửi email cho customer
      emailRecipient = appointment.customerId.email;
      recipientName = appointment.customerId.fullName;
    } else {
      // Nếu không có customerId = đặt cho bản thân → gửi email cho user
      emailRecipient = appointment.patientUserId.email;
      recipientName = appointment.patientUserId.fullName;
    }

    // Prepare email data
    const emailData = {
      fullName: recipientName,
      serviceName: appointment.serviceId.serviceName,
      doctorName: appointment.doctorUserId.fullName,
      startTime: appointment.timeslotId.startTime,
      endTime: appointment.timeslotId.endTime,
      type: appointment.type,
      mode: appointment.mode
    };

    // Xác định message và response dựa vào status
    let successMessage;
    let responseData = {
      appointmentId: appointment._id,
      service: appointment.serviceId.serviceName,
      doctor: appointment.doctorUserId.fullName,
      startTime: appointment.timeslotId.startTime,
      endTime: appointment.timeslotId.endTime,
      status: appointment.status,
      type: appointment.type,
      mode: appointment.mode
    };

    // Nếu appointment cần thanh toán trước
    if (appointment.status === 'PendingPayment' && appointment.paymentId) {
      successMessage = 'Vui lòng thanh toán để hoàn tất đặt lịch. Slot sẽ được giữ trong 15 phút.';
      
      // Thêm thông tin thanh toán vào response
      responseData.payment = {
        paymentId: appointment.paymentId._id,
        amount: appointment.paymentId.amount,
        method: appointment.paymentId.method,
        status: appointment.paymentId.status,
        expiresAt: appointment.paymentHoldExpiresAt,
        QRurl: appointment.paymentId.QRurl
      };
      
      responseData.requirePayment = true;
      
      // KHÔNG gửi email vì chưa thanh toán
      console.log('⏳ Appointment đang chờ thanh toán, không gửi email');
    } else {
      // Appointment không cần thanh toán hoặc đã thanh toán
      successMessage = appointment.customerId
        ? `Đặt lịch tư vấn thành công! Email xác nhận đã được gửi đến ${emailRecipient}`
        : 'Đặt lịch tư vấn thành công! Email xác nhận đã được gửi đến hộp thư của bạn.';
      
      responseData.requirePayment = false;

      // Gửi email xác nhận (chỉ khi không cần thanh toán)
      try {
        await emailService.sendAppointmentConfirmationEmail(
          emailRecipient,
          emailData
        );
        console.log(`📧 Đã gửi email xác nhận đến: ${emailRecipient}`);
      } catch (emailError) {
        console.error('Lỗi gửi email:', emailError);
      }
    }

    res.status(201).json({
      success: true,
      message: successMessage,
      data: responseData
    });

  } catch (error) {
    console.error('Lỗi đặt lịch tư vấn:', error);

    // Xử lý các lỗi cụ thể
    if (error.message.includes('Khung giờ') || 
        error.message.includes('Dịch vụ') || 
        error.message.includes('Bác sĩ') ||
        error.message.includes('không tồn tại') ||
        error.message.includes('không khả dụng') ||
        error.message.includes('Thiếu thông tin')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const reviewAppointment = async (req, res) => {
  try {
    const { appointmentId, action, cancelReason } = req.body;
    const staffUserId = req.user?.userId;

    // Validation
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ID lịch hẹn'
      });
    }

    // ⭐ Convert action to lowercase (case-insensitive)
    const normalizedAction = action?.toLowerCase().trim();

    if (!normalizedAction || !['approve', 'cancel'].includes(normalizedAction)) {
      return res.status(400).json({
        success: false,
        message: 'Action phải là "approve" hoặc "cancel" (không phân biệt chữ hoa/thường)'
      });
    }

    if (normalizedAction === 'cancel' && !cancelReason) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp lý do hủy lịch'
      });
    }

    if (!staffUserId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để xử lý lịch hẹn'
      });
    }

    // Gọi service với normalizedAction
    const result = await appointmentService.reviewAppointment(
      appointmentId,
      staffUserId,
      normalizedAction,
      cancelReason
    );

    res.status(200).json(result);

  } catch (error) {
    console.error('Lỗi xử lý lịch hẹn:', error);

    if (error.message.includes('Không tìm thấy') || 
        error.message.includes('Không thể') ||
        error.message.includes('phải là')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getPendingAppointments = async (req, res) => {
  try {
    const { doctorUserId, startDate, endDate } = req.query;

    const filters = {};
    if (doctorUserId) filters.doctorUserId = doctorUserId;
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }

    const result = await appointmentService.getPendingAppointments(filters);

    res.status(200).json(result);

  } catch (error) {
    console.error('Lỗi lấy danh sách lịch hẹn chờ duyệt:', error);

    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getAllAppointments = async (req, res) => {
  try {
    const { status, doctorUserId, patientUserId, mode, type } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (doctorUserId) filters.doctorUserId = doctorUserId;
    if (patientUserId) filters.patientUserId = patientUserId;
    if (mode) filters.mode = mode;
    if (type) filters.type = type;

    const result = await appointmentService.getAllAppointments(filters);

    res.status(200).json(result);

  } catch (error) {
    console.error('Lỗi lấy danh sách lịch hẹn:', error);

    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Lấy tất cả ca khám của người dùng hiện tại
 * GET /api/appointments/my-appointments
 * 
 * Logic:
 *   - Mặc định: Lấy tất cả các ca khám đã hoàn tất đặt lịch (Pending, Approved, CheckedIn, Completed, Cancelled)
 *     → Bao gồm cả đặt lịch khám (không cần thanh toán) và tư vấn đã thanh toán xong
 *   - KHÔNG bao gồm: PendingPayment (các ca tư vấn đang chờ thanh toán)
 * 
 * Query params:
 *   - includePendingPayment: true/false (có bao gồm cả ca đang chờ thanh toán không)
 *   - status: Pending|Approved|CheckedIn|Completed|Cancelled|PendingPayment (lọc theo status cụ thể)
 */
const getMyAppointments = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để xem ca khám'
      });
    }

    // Lấy options từ query params
    const options = {};
    
    // Có bao gồm cả ca đang chờ thanh toán không
    if (req.query.includePendingPayment === 'true') {
      options.includePendingPayment = true;
    }

    // Lọc theo status cụ thể
    if (req.query.status) {
      options.status = req.query.status;
    }

    console.log('🔍 [getMyAppointments] Fetching appointments for userId:', userId);
    console.log('🔍 [getMyAppointments] Options:', options);
    
    const appointments = await appointmentService.getUserAppointments(userId, options);

    console.log('✅ [getMyAppointments] Returning:', appointments.length, 'appointments');

    res.status(200).json({
      success: true,
      message: `Tìm thấy ${appointments.length} ca khám`,
      data: appointments,
      count: appointments.length
    });

  } catch (error) {
    console.error('❌ Lỗi lấy ca khám của user:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Cập nhật trạng thái ca khám
 * - Staff: Approved → CheckedIn (check-in bệnh nhân)
 * - Nurse: CheckedIn →
 * PUT /api/appointments/:appointmentId/status
 * Body: { status: 'CheckedIn' | 'Completed' | 'Cancelled' }
 */
const updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;
    const userId = req.user?.userId;

    // Validation
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ID lịch hẹn'
      });
    }

    const allowedStatuses = ['CheckedIn', 'Completed', 'Cancelled'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái phải là một trong: ${allowedStatuses.join(', ')}`
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập'
      });
    }

    // Gọi service để cập nhật
    const result = await appointmentService.updateAppointmentStatus(
      appointmentId,
      status,
      userId
    );

    res.status(200).json(result);

  } catch (error) {
    console.error('❌ Lỗi cập nhật trạng thái ca khám:', error);

    if (error.message.includes('Không tìm thấy') || 
        error.message.includes('Không thể') ||
        error.message.includes('chỉ có thể')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Hủy ca khám với logic khác nhau cho Examination/Consultation
 * DELETE /api/appointments/:appointmentId/cancel
 * Body: { cancelReason?: string }
 */
const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { cancelReason } = req.body;
    const userId = req.user?.userId;

    // Validation
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

    // Lấy thông tin appointment
    const appointment = await appointmentService.getAppointmentById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra quyền hủy lịch (chỉ người đặt lịch mới được hủy)
    if (appointment.patientUserId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền hủy lịch hẹn này'
      });
    }

    // Kiểm tra trạng thái appointment có thể hủy được không
    const cancellableStatuses = ['Pending', 'Approved', 'PendingPayment'];
    if (!cancellableStatuses.includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn này không thể hủy được'
      });
    }

    // Logic khác nhau cho Examination và Consultation
    if (appointment.type === 'Examination') {
      // Hủy bình thường cho Examination
      const result = await appointmentService.cancelAppointment(appointmentId, cancelReason, userId);
      
      res.status(200).json({
        success: true,
        message: 'Hủy lịch khám thành công',
        data: result
      });
    } else if (appointment.type === 'Consultation') {
      // Cho Consultation, trả về thông tin cần thiết để hiển thị popup
      const policies = await Policy.getActivePolicies();
      
      res.status(200).json({
        success: true,
        message: 'Xác nhận hủy lịch tư vấn',
        data: {
          appointment: {
            id: appointment._id,
            type: appointment.type,
            serviceName: appointment.serviceId.serviceName,
            doctorName: appointment.doctorUserId.fullName,
            startTime: appointment.timeslotId.startTime,
            endTime: appointment.timeslotId.endTime,
            status: appointment.status
          },
          policies: policies,
          requiresConfirmation: true
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Loại lịch hẹn không được hỗ trợ'
      });
    }

  } catch (error) {
    console.error('Lỗi hủy lịch hẹn:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Xác nhận hủy lịch tư vấn (sau khi user xác nhận trong popup)
 * POST /api/appointments/:appointmentId/confirm-cancel
 * Body: { confirmed: boolean, cancelReason?: string }
 */
const confirmCancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { confirmed, cancelReason, bankInfo } = req.body;
    const userId = req.user?.userId;

    // Validation
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ID lịch hẹn'
      });
    }

    if (typeof confirmed !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng xác nhận có muốn hủy lịch hay không'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập'
      });
    }

    if (confirmed) {
      // User xác nhận hủy
      const result = await appointmentService.cancelAppointment(appointmentId, cancelReason, userId, bankInfo);
      
      res.status(200).json({
        success: true,
        message: 'Hủy lịch tư vấn thành công',
        data: result
      });
    } else {
      // User không hủy
      res.status(200).json({
        success: true,
        message: 'Đã hủy bỏ thao tác hủy lịch hẹn',
        data: { cancelled: false }
      });
    }

  } catch (error) {
    console.error('Lỗi xác nhận hủy lịch hẹn:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
  confirmCancelAppointment
};
