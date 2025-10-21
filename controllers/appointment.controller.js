const appointmentService = require('../services/appointment.service');
const emailService = require('../services/email.service');

const createConsultationAppointment = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      appointmentFor,
      serviceId,
      doctorUserId, // User._id của doctor (user có role="Doctor")
      doctorScheduleId,
      selectedSlot // { startTime, endTime }
    } = req.body;

    // Lấy thông tin user đã đăng nhập
    const userId = req.user?.userId;

    if (!userId) {
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
      patientUserId: userId, // User._id của người đặt lịch
      doctorUserId: doctorUserId, // User._id của bác sĩ (user có role="Doctor")
      serviceId: serviceId,
      doctorScheduleId: doctorScheduleId,
      selectedSlot: selectedSlot, // { startTime, endTime }
      // mode sẽ tự động được set dựa vào service.category trong service layer
      // Consultation → Online, Examination → Offline
      notes: req.body.notes || null,
      // Thông tin từ form (để tạo customer nếu đặt cho người khác)
      formData: {
        fullName,
        email,
        phoneNumber,
        appointmentFor: appointmentFor || 'self'
      }
    };

    // Tạo appointment tư vấn qua service
    const appointment = await appointmentService.createConsultationAppointment(appointmentData);

    // Xác định gửi email đến ai
    // appointment đã được populate đầy đủ từ service
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

module.exports = {
  createConsultationAppointment
};
