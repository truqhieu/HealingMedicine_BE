const Appointment = require('../models/appointment.model');
const Timeslot = require('../models/timeslot.model');
const Service = require('../models/service.model');
const User = require('../models/user.model');
const Customer = require('../models/customer.model');
const DoctorSchedule = require('../models/doctorSchedule.model');
const { calculateServicePrice } = require('../utils/promotionHelper');

class AppointmentService {

  async createConsultationAppointment(appointmentData) {
    const {
      patientUserId,
      doctorUserId,
      serviceId,
      doctorScheduleId,
      selectedSlot, // { startTime, endTime } từ available slots
      notes,
      fullName,
      email,
      phoneNumber,
      appointmentFor
    } = appointmentData;

    // Validate required fields
    if (!patientUserId || !doctorUserId || !serviceId || !doctorScheduleId || !selectedSlot) {
      throw new Error('Vui lòng nhập đầy đủ thông tin để đặt lịch tư vấn.');
    }

    if (!selectedSlot.startTime || !selectedSlot.endTime) {
      throw new Error('Thông tin khung giờ không hợp lệ. Vui lòng chọn lại thời gian.');
    }

    // Kiểm tra patient có tồn tại không và lấy thông tin email
    const patient = await User.findById(patientUserId);
    if (!patient) {
      throw new Error('Tài khoản của bạn không hợp lệ. Vui lòng đăng nhập lại.');
    }

    // Kiểm tra service có tồn tại không
    const service = await Service.findById(serviceId);
    if (!service) {
      throw new Error('Dịch vụ bạn chọn không tồn tại. Vui lòng chọn dịch vụ khác.');
    }

    if (service.status !== 'Active') {
      throw new Error('Dịch vụ này hiện không khả dụng');
    }

    // ⭐ Tính promotion cho service này
    const promotionData = await calculateServicePrice(serviceId, service.price);
    const finalPrice = promotionData.finalPrice;
    const originalPrice = promotionData.originalPrice;
    
    console.log('💰 Thông tin giá dịch vụ:');
    console.log('   - Giá gốc:', originalPrice, 'VND');
    console.log('   - Giá sau giảm:', finalPrice, 'VND');
    if (promotionData.hasPromotion) {
      console.log('   - Có promotion:', promotionData.promotionInfo.title);
      console.log('   - Giảm:', promotionData.discountAmount, 'VND');
    }

    // Kiểm tra nếu service yêu cầu thanh toán trước (Consultation)
    if (service.isPrepaid && service.category === 'Consultation') {
      console.log('⚠️ Service này yêu cầu thanh toán trước:', service.serviceName);
      console.log('💰 Số tiền cần thanh toán:', finalPrice, 'VND');
    }

    // Xác định mode dựa vào category của service
    let appointmentMode;
    if (service.category === 'Consultation') {
      appointmentMode = 'Online'; // Tư vấn online
    } else if (service.category === 'Examination') {
      appointmentMode = 'Offline'; // Khám offline
    } else {
      appointmentMode = 'Online'; // Mặc định online
    }

    // Xác định customerId dựa vào appointmentFor
    // appointmentFor: 'self' | 'other'
    let customerId = null;
    
    // Log thông tin để kiểm tra
    console.log('📋 Thông tin đặt lịch:');
    console.log('- Service:', service.serviceName);
    console.log('- Category:', service.category);
    console.log('- isPrepaid:', service.isPrepaid);
    console.log('- Mode được set:', appointmentMode);
    console.log('- Họ tên từ form:', fullName);
    console.log('- SĐT từ form:', phoneNumber);
    console.log('- Email từ user đăng nhập:', patient.email);
    console.log('- Đặt cho:', appointmentFor || 'self');

    // ⭐ THÊM: Validate customer conflict khi đặt cho người khác
    if (appointmentFor === 'other' && fullName && email) {
      console.log(`🔍 Checking customer conflict for: ${fullName} <${email}>`);
      
      // Normalize name và email (lowercase, remove extra spaces/diacritics)
      const normalizeString = (str) => {
        return str
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ' ') // Normalize spaces
          .normalize('NFD') // Remove diacritics
          .replace(/[\u0300-\u036f]/g, '');
      };

      const normalizedFullName = normalizeString(fullName);
      const normalizedEmail = normalizeString(email);
      
      console.log(`   - Normalized: ${normalizedFullName} <${normalizedEmail}>`);
      
      // Tìm customer với matching fullName + email
      const Customer = require('../models/customer.model');
      const existingCustomer = await Customer.findOne({
        fullName: new RegExp(`^${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      });
      
      if (existingCustomer) {
        console.log(` Tìm thấy existing customer: ${existingCustomer._id}`);
        
        // Kiểm tra xem customer này đã có appointment vào khung giờ này chưa
        const conflictAppointment = await Appointment.findOne({
          customerId: existingCustomer._id,
          status: { $in: ['Pending', 'Approved', 'CheckedIn', 'Completed'] },
          'timeslotId': {
            $elemMatch: {
              startTime: new Date(selectedSlot.startTime),
              endTime: new Date(selectedSlot.endTime)
            }
          }
        }).populate('timeslotId');

        // Nếu không tìm được qua $elemMatch, thử cách khác
        if (!conflictAppointment) {
          const conflictAppt = await Appointment.findOne({
            customerId: existingCustomer._id,
            status: { $in: ['Pending', 'Approved', 'CheckedIn', 'Completed'] }
          }).populate('timeslotId');

          if (conflictAppt && conflictAppt.timeslotId) {
            const appointmentStartTime = new Date(conflictAppt.timeslotId.startTime);
            const appointmentEndTime = new Date(conflictAppt.timeslotId.endTime);
            const slotStartTime = new Date(selectedSlot.startTime);
            const slotEndTime = new Date(selectedSlot.endTime);
            
            // ⭐ THÊM: Tính buffer time (10 phút)
            const bufferTime = 10; // 10 phút buffer
            const slotEndTimeWithBuffer = new Date(slotEndTime.getTime() + bufferTime * 60000);
            
            // Conflict nếu: slotStartTime < appointmentEndTime && slotEndTimeWithBuffer > appointmentStartTime
            if (slotStartTime < appointmentEndTime && slotEndTimeWithBuffer > appointmentStartTime) {
              console.log(`❌ Customer ${fullName} đã có lịch khám vào khung giờ này (bao gồm buffer time)`);
              throw new Error(`${fullName} đã có lịch khám vào khung giờ này rồi. Vui lòng chọn khung giờ khác!`);
            }
          }
        } else {
          console.log(` Customer ${fullName} đã có lịch khám vào khung giờ này`);
          throw new Error(`${fullName} đã có lịch khám vào khung giờ này rồi. Vui lòng chọn khung giờ khác!`);
        }
      }
    }

    // ⭐ THÊM: CHECK TIMESLOT TRƯỚC KHI TẠO ❌
    // Để tránh race condition: 2 request cùng lúc
    const slotStartTime = new Date(selectedSlot.startTime);
    const slotEndTime = new Date(selectedSlot.endTime);
    
    // ⭐ THÊM: Tính buffer time (10 phút)
    const timeslotBufferTime = 10; // 10 phút buffer
    const slotEndTimeWithBuffer = new Date(slotEndTime.getTime() + timeslotBufferTime * 60000);
    
    // ⭐ Không cho đặt thời gian ở quá khứ
    const nowUtc = new Date();
    if (slotStartTime.getTime() < nowUtc.getTime()) {
      throw new Error('Không thể đặt thời gian ở quá khứ');
    }
    
    // Kiểm tra conflict với timeslots đã có (bao gồm buffer time)
    const conflictingTimeslots = await Timeslot.find({
      doctorUserId: doctorUserId,
      startTime: { $lt: slotEndTimeWithBuffer },
      endTime: { $gt: slotStartTime },
      status: { $in: ['Reserved', 'Booked'] }
    });

    if (conflictingTimeslots.length > 0) {
      console.log('❌ Khung giờ bị conflict với timeslots đã có:', conflictingTimeslots.length);
      conflictingTimeslots.forEach(ts => {
        console.log(`   - Timeslot ${ts._id}: ${ts.startTime} - ${ts.endTime} (${ts.status})`);
      });
      throw new Error(`Khung giờ này đã có người đặt hoặc đang chờ thanh toán. Vui lòng chọn thời gian khác.`);
    }

    // Validate selectedSlot duration phải khớp với service duration
    const slotDurationMinutes = (slotEndTime - slotStartTime) / 60000;

    if (slotDurationMinutes !== service.durationMinutes) {
      throw new Error(
        `Khung giờ không hợp lệ. Dịch vụ "${service.serviceName}" cần ${service.durationMinutes} phút, ` +
        `nhưng thời gian bạn chọn là ${slotDurationMinutes} phút. Vui lòng chọn lại.`
      );
    }

    // Kiểm tra doctor schedule
    const schedule = await DoctorSchedule.findById(doctorScheduleId);
    if (!schedule) {
      throw new Error('Lịch làm việc của bác sĩ không tồn tại. Vui lòng tải lại trang hoặc chọn bác sĩ khác.');
    }

    // Kiểm tra doctor có tồn tại không (từ bảng User với role="Doctor")
    const doctor = await User.findById(doctorUserId);
    if (!doctor) {
      throw new Error('Bác sĩ bạn chọn không tồn tại. Vui lòng chọn bác sĩ khác.');
    }

    if (doctor.role !== 'Doctor') {
      throw new Error('Bác sĩ bạn chọn không hợp lệ. Vui lòng chọn bác sĩ khác.');
    }

    if (doctor.status !== 'Active') {
      throw new Error('Bác sĩ bạn chọn hiện không khả dụng. Vui lòng chọn bác sĩ khác.');
    }

    // ⭐ THÊM: Kiểm tra user đã có lịch hẹn trùng giờ với bác sĩ hiện tại chưa
    // Cho phép đặt trùng giờ với bác sĩ khác
    const slotStart = new Date(selectedSlot.startTime);
    const slotEnd = new Date(selectedSlot.endTime);
    
    // Lấy appointments của user với bác sĩ hiện tại trong cùng ngày
    const sameDayAppointments = await Appointment.find({
      patientUserId,
      doctorUserId,
      status: { $in: ['PendingPayment', 'Pending', 'Approved', 'CheckedIn'] },
      timeslotId: { $exists: true }
    })
    .populate({
      path: 'timeslotId',
      select: 'startTime endTime'
    });

    // Filter appointments có overlap thời gian (bao gồm buffer time)
    const userBufferTime = 10; // 10 phút buffer
    const slotEndWithBuffer = new Date(slotEnd.getTime() + userBufferTime * 60000);
    
    for (const apt of sameDayAppointments) {
      if (!apt.timeslotId) continue;

      const aptStart = new Date(apt.timeslotId.startTime);
      const aptEnd = new Date(apt.timeslotId.endTime);
      
      // Check overlap: (start1 < end2) AND (end1WithBuffer > start2)
      const hasTimeOverlap = (slotStart < aptEnd && slotEndWithBuffer > aptStart);
      
      if (hasTimeOverlap) {
        const aptDateVN = aptStart.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const aptStartVN = aptStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
        const aptEndVN = aptEnd.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
        
        throw new Error(
          `Bạn đã có lịch hẹn với bác sĩ này vào ${aptDateVN} từ ${aptStartVN} - ${aptEndVN}. ` +
          `Vui lòng chọn bác sĩ khác hoặc thời gian khác.`
        );
      }
    }

    // Nếu đặt cho người khác, tạo Customer
    if (appointmentFor === 'other') {
      if (!fullName || !email || !phoneNumber) {
        throw new Error('Vui lòng nhập đầy đủ họ tên, email và số điện thoại của người được đặt lịch (customer)');
      }

      // ⭐ Validate: Check xem user đã đặt cho customer này vào cùng thời gian chưa
      // Normalize function để so sánh không phân biệt hoa thường, dấu cách
      const normalizeString = (str) => {
        if (!str) return '';
        return str.toLowerCase().trim().replace(/\s+/g, ' ');
      };

      const normalizedFullName = normalizeString(fullName);
      const normalizedEmail = normalizeString(email);

      // Lấy tất cả appointments của user vào cùng thời gian
      const slotStart = new Date(selectedSlot.startTime);
      const slotEnd = new Date(selectedSlot.endTime);

      const overlappingAppointments = await Appointment.find({
        patientUserId,
        appointmentFor: 'other',
        status: { $in: ['PendingPayment', 'Pending', 'Approved', 'CheckedIn'] },
        customerId: { $exists: true },
        timeslotId: { $exists: true }
      })
      .populate({
        path: 'timeslotId',
        select: 'startTime endTime'
      })
      .populate({
        path: 'customerId',
        select: 'fullName email'
      });

      // Filter appointments có overlap thời gian (bao gồm buffer time)
      for (const apt of overlappingAppointments) {
        if (!apt.timeslotId || !apt.customerId) continue;

        const aptStart = new Date(apt.timeslotId.startTime);
        const aptEnd = new Date(apt.timeslotId.endTime);

        // ⭐ THÊM: Tính buffer time (10 phút)
        const customerBufferTime = 10; // 10 phút buffer
        const slotEndWithBuffer = new Date(slotEnd.getTime() + customerBufferTime * 60000);

        // Check overlap: (start1 < end2) AND (end1WithBuffer > start2)
        const hasTimeOverlap = (slotStart < aptEnd && slotEndWithBuffer > aptStart);

        if (hasTimeOverlap) {
          // Có trùng thời gian → check xem có trùng customer không
          const existingFullName = normalizeString(apt.customerId.fullName);
          const existingEmail = normalizeString(apt.customerId.email);

          if (existingFullName === normalizedFullName && existingEmail === normalizedEmail) {
            const aptStartDisplay = `${String(aptStart.getUTCHours()).padStart(2, '0')}:${String(aptStart.getUTCMinutes()).padStart(2, '0')}`;
            const aptEndDisplay = `${String(aptEnd.getUTCHours()).padStart(2, '0')}:${String(aptEnd.getUTCMinutes()).padStart(2, '0')}`;
            
            throw new Error(
              `Bạn đã đặt lịch cho "${fullName}" vào ${aptStartDisplay} - ${aptEndDisplay}. ` +
              `Vui lòng chọn thời gian khác.`
            );
          }
        }
      }

      // Tạo Customer mới
      const newCustomer = await Customer.create({
        patientUserId: patientUserId, 
        fullName: fullName,
        email: email, 
        phoneNumber: phoneNumber,
        hasAccount: false,
        linkedUserId: null
      });

      customerId = newCustomer._id;
      console.log('✅ Đã tạo Customer cho người được đặt lịch:');
      console.log('   - Customer ID:', newCustomer._id);
      console.log('   - Họ tên:', fullName);
      console.log('   - Email:', email);
      console.log('   - SĐT:', phoneNumber);
    }

    // Tạo Timeslot mới từ slot được chọn
    const newTimeslot = await Timeslot.create({
      doctorScheduleId: schedule._id,
      doctorUserId,
      serviceId,
      startTime: new Date(selectedSlot.startTime),
      endTime: new Date(selectedSlot.endTime),
      breakAfterMinutes: 10,
      // ⭐ FIXED: Nếu dịch vụ cần thanh toán trước, slot là "Reserved" (chưa xác nhận)
      // Khi thanh toán xong mới thành "Booked"
      status: service.isPrepaid ? 'Reserved' : 'Booked',
      appointmentId: null // Sẽ update sau khi tạo appointment
    });

    console.log('✅ Đã tạo Timeslot:', newTimeslot._id);

    // Xác định type dựa vào category
    let appointmentType;
    if (service.category === 'Consultation') {
      appointmentType = 'Consultation';
    } else if (service.category === 'Examination') {
      appointmentType = 'Examination';
    } else {
      appointmentType = 'Consultation'; // Mặc định
    }

    // Xác định status và expireAt dựa vào isPrepaid
    let appointmentStatus = 'Pending';
    let paymentHoldExpiresAt = null;
    
    if (service.isPrepaid) {
      // Nếu cần thanh toán trước, set status PendingPayment và expire sau 3 phút (cho demo)
      appointmentStatus = 'PendingPayment';
      paymentHoldExpiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 phút (demo)
      console.log('💳 Appointment cần thanh toán trước, giữ slot đến:', paymentHoldExpiresAt);
    }

    // Tạo appointment mới
    console.log('✅ Tạo appointment với data:', {
      patientUserId,
      customerId,
      doctorUserId,
      serviceId,
      status: appointmentStatus,
      type: appointmentType,
      mode: appointmentMode
    });

    const newAppointment = await Appointment.create({
      patientUserId, // Người đặt lịch (booker)
      customerId, // null nếu đặt cho bản thân, có giá trị nếu đặt cho người khác
      doctorUserId,
      serviceId,
      timeslotId: newTimeslot._id,
      status: appointmentStatus, // 'PendingPayment' nếu isPrepaid, 'Pending' nếu không
      type: appointmentType, // Dựa vào service.category
      mode: appointmentMode, // Consultation=Online, Examination=Offline
      notes: notes || null,
      bookedByUserId: patientUserId,
      paymentHoldExpiresAt: paymentHoldExpiresAt,
      appointmentFor: appointmentFor || 'self', // ⭐ THÊM: Lưu appointmentFor
      // ⭐ THÊM: Lưu promotion info
      promotionId: promotionData.promotionInfo?.promotionId || null,
      originalPrice: originalPrice,
      finalPrice: finalPrice,
      discountAmount: promotionData.discountAmount
    });

    console.log('✅ Appointment đã được tạo:', {
      id: newAppointment._id,
      patientUserId: newAppointment.patientUserId,
      customerId: newAppointment.customerId,
      appointmentFor: newAppointment.appointmentFor,
      status: newAppointment.status
    });

    // Update timeslot với appointmentId
    // ⭐ FIXED: Update status thành "Reserved" nếu cần thanh toán
    await Timeslot.findByIdAndUpdate(newTimeslot._id, {
      appointmentId: newAppointment._id,
      status: service.isPrepaid ? 'Reserved' : 'Booked'
    });

    // Nếu cần thanh toán trước, tạo Payment record và QR code
    let paymentRecord = null;
    let qrData = null;
    
    if (service.isPrepaid) {
      const paymentService = require('./payment.service');
      
      // Xác định tên khách hàng để hiển thị trên QR
      let customerName = patient.fullName; // Mặc định là người đặt lịch
      if (customerId) {
        // Nếu đặt cho người khác, dùng tên customer
        const customer = await Customer.findById(customerId);
        if (customer) {
          customerName = customer.fullName;
        }
      }
      
      const paymentResult = await paymentService.createPayment({
        appointmentId: newAppointment._id,
        patientUserId: patientUserId,
        amount: finalPrice, // ⭐ Sửa: Dùng finalPrice thay vì service.price
        holdExpiresAt: paymentHoldExpiresAt,
        customerName: customerName // Tên sẽ hiển thị trên QR
      });

      paymentRecord = paymentResult.payment;
      qrData = paymentResult.qrData;

      // Update appointment với paymentId
      await Appointment.findByIdAndUpdate(newAppointment._id, {
        paymentId: paymentRecord._id
      });

      console.log('✅ Đã tạo Payment record:', paymentRecord._id);
      console.log('💰 Số tiền cần thanh toán:', finalPrice, 'VND');
      console.log('📱 QR Code:', qrData.qrUrl);
    }

    // Populate thông tin đầy đủ
    const populatedAppointment = await Appointment.findById(newAppointment._id)
      .populate('patientUserId', 'fullName email')
      .populate('doctorUserId', 'fullName email')
      .populate('serviceId', 'serviceName price durationMinutes category isPrepaid')
      .populate('timeslotId', 'startTime endTime')
      .populate('customerId', 'fullName email phoneNumber')
      .populate('paymentId');

    console.log('✅ Appointment đã tạo với mode:', populatedAppointment.mode);
    console.log('✅ Status:', populatedAppointment.status);

    // Chuẩn hóa response cho FE: trả requirePayment và thông tin QR nếu cần
    const responsePayload = {
      appointmentId: String(populatedAppointment._id),
      service: populatedAppointment.serviceId?.serviceName,
      doctor: populatedAppointment.doctorUserId?.fullName,
      startTime: populatedAppointment.timeslotId?.startTime,
      endTime: populatedAppointment.timeslotId?.endTime,
      status: populatedAppointment.status,
      type: populatedAppointment.type,
      mode: populatedAppointment.mode,
      requirePayment: !!service.isPrepaid
    };

    if (service.isPrepaid && paymentRecord) {
      responsePayload.payment = {
        paymentId: String(paymentRecord._id),
        amount: service.price,
        method: paymentRecord.method,
        status: paymentRecord.status,
        expiresAt: paymentRecord.holdExpiresAt,
        QRurl: paymentRecord.QRurl || (qrData ? qrData.qrUrl : null)
      };
    }

    return responsePayload;
  }

  async reviewAppointment(appointmentId, staffUserId, action, cancelReason = null) {
    try {
      // Kiểm tra appointment tồn tại
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        throw new Error('Không tìm thấy lịch hẹn');
      }

      // Kiểm tra action hợp lệ
      if (!['approve', 'cancel'].includes(action)) {
        throw new Error('Action phải là "approve" hoặc "cancel"');
      }

      // Kiểm tra appointment status có thể review không
      if (!['Pending', 'Approved'].includes(appointment.status)) {
        throw new Error(`Không thể xử lý lịch hẹn ở trạng thái ${appointment.status}`);
      }

      // Nếu là PendingPayment, không được phép xử lý
      if (appointment.status === 'PendingPayment') {
        throw new Error('Lịch hẹn đang chờ thanh toán. Vui lòng chờ khách hàng thanh toán hoặc hủy yêu cầu này.');
      }

      // Lấy đầy đủ thông tin
      const populatedAppointment = await Appointment.findById(appointmentId)
        .populate('patientUserId', 'fullName email')
        .populate('customerId', 'fullName email phoneNumber')
        .populate('doctorUserId', 'fullName email')
        .populate('serviceId', 'serviceName price durationMinutes category')
        .populate('timeslotId', 'startTime endTime');

      // Xác định người nhận email
      let emailRecipient, recipientName;
      if (populatedAppointment.customerId) {
        emailRecipient = populatedAppointment.customerId.email;
        recipientName = populatedAppointment.customerId.fullName;
      } else {
        emailRecipient = populatedAppointment.patientUserId.email;
        recipientName = populatedAppointment.patientUserId.fullName;
      }

      // Các biến dùng chung
      let updatedAppointment;
      let emailData;
      const emailService = require('./email.service');

      // ========== APPROVE ACTION ==========
      if (action === 'approve') {
        console.log('✅ Duyệt lịch hẹn...');

        // ⭐ Nếu là Consultation (Online), tạo Google Meet link
        let meetLink = null;
        if (populatedAppointment.mode === 'Online' && populatedAppointment.type === 'Consultation') {
          console.log('📞 Tạo Google Meet link cho tư vấn online...');
          
          const googleMeetService = require('./googleMeetService');
          
          try {
            meetLink = await googleMeetService.generateMeetLink({
              appointmentId: appointmentId,
              doctorName: populatedAppointment.doctorUserId.fullName,
              patientName: recipientName,
              startTime: populatedAppointment.timeslotId.startTime,
              endTime: populatedAppointment.timeslotId.endTime,
              serviceName: populatedAppointment.serviceId.serviceName
            });
            console.log('✅ Google Meet link đã tạo:', meetLink);
          } catch (meetError) {
            console.error('❌ Lỗi tạo Google Meet link:', meetError.message);
            // Vẫn tiếp tục, fallback link được xử lý trong service
          }
        }

        // Update status sang Approved
        updatedAppointment = await Appointment.findByIdAndUpdate(
          appointmentId,
          {
            status: 'Approved',
            approvedByUserId: staffUserId,
            linkMeetUrl: meetLink
          },
          { new: true }
        )
          .populate('patientUserId', 'fullName email')
          .populate('customerId', 'fullName email phoneNumber')
          .populate('doctorUserId', 'fullName email')
          .populate('serviceId', 'serviceName price durationMinutes category')
          .populate('timeslotId', 'startTime endTime');

        console.log('✅ Appointment updated:', updatedAppointment._id);

        // Prepare email
        emailData = {
          fullName: recipientName,
          serviceName: updatedAppointment.serviceId.serviceName,
          doctorName: updatedAppointment.doctorUserId.fullName,
          startTime: updatedAppointment.timeslotId.startTime,
          endTime: updatedAppointment.timeslotId.endTime,
          type: updatedAppointment.type,
          mode: updatedAppointment.mode,
          meetLink: updatedAppointment.linkMeetUrl
        };

        // ⭐ GỬI EMAIL ASYNC (NON-BLOCKING) - Không chờ xong mới trả response
        (async () => {
          try {
            console.log('📧 Bắt đầu gửi email xác nhận duyệt...');
            await emailService.sendAppointmentApprovedEmail(emailRecipient, emailData);
            console.log(`✅ Email xác nhận duyệt đã gửi thành công đến: ${emailRecipient}`);
          } catch (emailError) {
            console.error('❌ Lỗi gửi email xác nhận duyệt:', emailError.message);
            console.error('📧 Email recipient:', emailRecipient);
            console.error('📧 Error details:', emailError);
          }
        })();

        // ⭐ TRẢ RESPONSE NGAY (response không chờ email)
        return {
          success: true,
          message: 'Lịch hẹn đã được duyệt. Email xác nhận sẽ được gửi trong vài giây',
          data: updatedAppointment
        };
      }

      // ========== CANCEL ACTION ==========
      if (action === 'cancel') {
        console.log('❌ Hủy lịch hẹn...');

        // Xóa timeslot
        if (populatedAppointment.timeslotId) {
          await Timeslot.findByIdAndUpdate(populatedAppointment.timeslotId._id, {
            status: 'Available',
            appointmentId: null
          });
          console.log('✅ Timeslot đã được release');
        }

        // Update status sang Cancelled
        updatedAppointment = await Appointment.findByIdAndUpdate(
          appointmentId,
          {
            status: 'Cancelled',
            approvedByUserId: staffUserId,
            cancelReason: cancelReason || 'Lịch hẹn đã bị hủy',
            cancelledAt: new Date()
          },
          { new: true }
        )
          .populate('patientUserId', 'fullName email')
          .populate('customerId', 'fullName email phoneNumber')
          .populate('doctorUserId', 'fullName email')
          .populate('serviceId', 'serviceName price durationMinutes category')
          .populate('timeslotId', 'startTime endTime');

        console.log('✅ Appointment cancelled:', updatedAppointment._id);

        // Prepare email
        emailData = {
          fullName: recipientName,
          serviceName: updatedAppointment.serviceId.serviceName,
          doctorName: updatedAppointment.doctorUserId.fullName,
          startTime: updatedAppointment.timeslotId.startTime,
          endTime: updatedAppointment.timeslotId.endTime,
          type: updatedAppointment.type,
          mode: updatedAppointment.mode,
          cancelReason: cancelReason || 'Lịch hẹn đã bị hủy'
        };

        // ⭐ GỬI EMAIL ASYNC (NON-BLOCKING) - Không chờ xong mới trả response
        (async () => {
          try {
            console.log('📧 Bắt đầu gửi email thông báo hủy lịch...');
            await emailService.sendAppointmentCancelledEmail(emailRecipient, emailData);
            console.log(`✅ Email thông báo hủy lịch đã gửi thành công đến: ${emailRecipient}`);
          } catch (emailError) {
            console.error('❌ Lỗi gửi email thông báo hủy:', emailError.message);
            console.error('📧 Email recipient:', emailRecipient);
            console.error('📧 Error details:', emailError);
          }
        })();

        // ⭐ TRẢ RESPONSE NGAY (response không chờ email)
        return {
          success: true,
          message: 'Lịch hẹn đã bị hủy. Email thông báo sẽ được gửi trong vài giây',
          data: updatedAppointment
        };
      }

    } catch (error) {
      console.error('❌ Lỗi xử lý lịch hẹn:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách lịch hẹn chờ duyệt (Pending)
   * Dùng cho staff review - HIỂN THỊ TẤT CẢ (không giới hạn thời gian)
   * ⚠️ CHỈ hiển thị lịch "Pending" - không hiển thị "PendingPayment"
   * (PendingPayment đang chờ thanh toán, chưa cần Staff duyệt)
   */
  async getPendingAppointments(filters = {}) {
    try {
      const query = {
        status: 'Pending' // ⭐ CHỈ lấy Pending, KHÔNG lấy PendingPayment
      };

      // ⭐ Có thể filter theo doctor (nếu cần)
      if (filters.doctorUserId) {
        query.doctorUserId = filters.doctorUserId;
      }

      // ⚠️ BỎ FILTER THEO THỜI GIAN - Staff cần xem TẤT CẢ lịch pending
      // Staff cần duyệt/từ chối tất cả các yêu cầu bệnh nhân gửi đến,
      // không quan tâm ngày gửi là bao giờ

      const appointments = await Appointment.find(query)
        .populate('patientUserId', 'fullName email phoneNumber')
        .populate('customerId', 'fullName email phoneNumber')
        .populate('doctorUserId', 'fullName email')
        .populate('serviceId', 'serviceName price durationMinutes category')
        .populate('timeslotId', 'startTime endTime')
        .sort({ createdAt: -1 }); // Sắp xếp mới nhất trước

      console.log(`📋 Staff - Lấy ${appointments.length} lịch hẹn "Pending" (TẤT CẢ thời gian, không bao gồm PendingPayment)`);

      return {
        success: true,
        data: appointments,
        count: appointments.length
      };
    } catch (error) {
      console.error('❌ Lỗi lấy danh sách lịch hẹn:', error);
      throw error;
    }
  }

  /**
   * Helper: Check và update expired appointments realtime
   * @private
   */
  async _checkAndUpdateExpiredAppointments(appointments) {
    const now = new Date();
    let updatedCount = 0;

    for (const appointment of appointments) {
      // Chỉ check appointments đang "Pending"
      if (appointment.status !== 'Pending') continue;
      
      if (!appointment.timeslotId || !appointment.timeslotId.startTime) continue;

      // Lấy ngày khám từ timeslot
      const appointmentDate = new Date(appointment.timeslotId.startTime);
      
      // Tạo cutoff time: 18:00 UTC của ngày hẹn
      const cutoffTime = new Date(appointmentDate);
      cutoffTime.setUTCHours(18, 0, 0, 0);

      // Kiểm tra: Nếu hiện tại đã qua 18:00 của ngày hẹn
      if (now >= cutoffTime) {
        appointment.status = 'Expired';
        await appointment.save();
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`⏰ [getAllAppointments] Đã expire ${updatedCount} appointment(s)`);
    }
  }

  /**
   * Lấy danh sách tất cả appointments (có filter)
   */
  async getAllAppointments(filters = {}) {
    try {
      const query = {};

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.doctorUserId) {
        query.doctorUserId = filters.doctorUserId;
      }

      if (filters.patientUserId) {
        query.patientUserId = filters.patientUserId;
      }

      if (filters.mode) {
        query.mode = filters.mode;
      }

      if (filters.type) {
        query.type = filters.type;
      }

      const appointments = await Appointment.find(query)
        .populate('patientUserId', 'fullName email')
        .populate('customerId', 'fullName email')
        .populate('doctorUserId', 'fullName email')
        .populate('serviceId', 'serviceName price')
        .populate('timeslotId', 'startTime endTime')
        .sort({ createdAt: -1 });

      // ⭐ Check và update expired appointments realtime (deprecated - use AppointmentMonitorService instead)
      // await this._checkAndUpdateExpiredAppointments(appointments);

      // Lấy lại data sau khi update (nếu có thay đổi)
      const updatedAppointments = await Appointment.find(query)
        .populate('patientUserId', 'fullName email')
        .populate('customerId', 'fullName email')
        .populate('doctorUserId', 'fullName email')
        .populate('serviceId', 'serviceName price')
        .populate('timeslotId', 'startTime endTime')
        .sort({ createdAt: -1 });

      return {
        success: true,
        data: updatedAppointments,
        count: updatedAppointments.length
      };
    } catch (error) {
      console.error('❌ Lỗi lấy danh sách lịch hẹn:', error);
      throw error;
    }
  }

  /**
   * Lấy tất cả ca khám của một người dùng
   */
  async getUserAppointments(userId, options = {}) {
    try {
      // Build query
      const query = { patientUserId: userId };

      console.log('🔍 [getUserAppointments] Query với userId:', userId);

      // Lọc theo status cụ thể nếu có
      if (options.status) {
        query.status = options.status;
      } else {
        // Mặc định: Lấy tất cả các ca khám ĐÃ HOÀN TẤT ĐẶT LỊCH
        // (bao gồm cả đặt lịch khám không cần thanh toán trước và tư vấn đã thanh toán)
        // NGOẠI TRỪ "PendingPayment" (đang chờ thanh toán cho tư vấn online)
        if (options.includePendingPayment) {
          // Lấy tất cả bao gồm cả PendingPayment
          query.status = { $in: ['PendingPayment', 'Pending', 'Approved', 'CheckedIn', 'InProgress', 'Completed', 'Cancelled', 'Expired'] };
        } else {
          // Mặc định: Chỉ lấy các ca đã hoàn tất đặt lịch (đã thanh toán nếu cần)
          query.status = { $in: ['Pending', 'Approved', 'CheckedIn', 'InProgress', 'Completed', 'Cancelled', 'Expired'] };
        }
      }

      console.log('🔍 [getUserAppointments] Final query:', JSON.stringify(query));

      const appointments = await Appointment.find(query)
        .populate('patientUserId', 'fullName email phoneNumber')
        .populate('doctorUserId', 'fullName email specialization')
        .populate('serviceId', 'serviceName price category durationMinutes')
        .populate('timeslotId', 'startTime endTime')
        .populate('customerId', 'fullName email phoneNumber')
        .populate('paymentId') // ⭐ Populate tất cả fields của paymentId để có _id
        .sort({ createdAt: -1 }); // Sắp xếp theo thời gian tạo mới nhất

      console.log('✅ [getUserAppointments] Tìm thấy:', appointments.length, 'appointments');
      console.log('📋 [getUserAppointments] Appointments:', appointments.map(apt => ({
        id: apt._id,
        status: apt.status,
        appointmentFor: apt.appointmentFor,
        patientUserId: apt.patientUserId?._id,
        customerId: apt.customerId?._id,
        customerName: apt.customerId?.fullName,
        serviceName: apt.serviceId?.serviceName
      })));

      // Trả về đúng format mà frontend expect
      return appointments.map(apt => ({
        _id: apt._id.toString(),
        status: apt.status,
        type: apt.type,
        mode: apt.mode,
        appointmentFor: apt.appointmentFor || 'self',
        patientUserId: apt.patientUserId ? {
          fullName: apt.patientUserId.fullName,
          email: apt.patientUserId.email,
          phoneNumber: apt.patientUserId.phoneNumber
        } : null,
        doctorUserId: apt.doctorUserId ? {
          fullName: apt.doctorUserId.fullName,
          email: apt.doctorUserId.email,
          specialization: apt.doctorUserId.specialization
        } : null,
        serviceId: apt.serviceId ? {
          serviceName: apt.serviceId.serviceName,
          price: apt.serviceId.price,
          category: apt.serviceId.category,
          durationMinutes: apt.serviceId.durationMinutes
        } : null,
        timeslotId: apt.timeslotId ? {
          startTime: apt.timeslotId.startTime,
          endTime: apt.timeslotId.endTime
        } : null,
        customerId: apt.customerId ? {
          fullName: apt.customerId.fullName,
          email: apt.customerId.email,
          phoneNumber: apt.customerId.phoneNumber
        } : null,
        paymentId: apt.paymentId ? {
          _id: apt.paymentId._id?.toString() || apt.paymentId._id || null,
          status: apt.paymentId.status,
          amount: apt.paymentId.amount,
          method: apt.paymentId.method
        } : null,
        notes: apt.notes || '',
        linkMeetUrl: apt.linkMeetUrl || null,
        checkedInAt: apt.checkedInAt || null,
        createdAt: apt.createdAt,
        updatedAt: apt.updatedAt
      }));
    } catch (error) {
      console.error('❌ Lỗi lấy ca khám của user:', error);
      throw error;
    }
  }

  /**
   * Cập nhật trạng thái ca khám
   * - Staff: Approved → CheckedIn (check-in bệnh nhân)
   */
  async updateAppointmentStatus(appointmentId, newStatus, userId) {
    try {
      console.log(`🔄 Cập nhật trạng thái ca khám ${appointmentId} → ${newStatus}`);

      // Tìm appointment
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        throw new Error('Không tìm thấy lịch hẹn');
      }

      // ⚠️ Kiểm tra logic chuyển trạng thái
      const currentStatus = appointment.status;

      // ✅ Allowed transitions:
      // Approved → CheckedIn (Staff/Nurse check-in bệnh nhân đã đến)
      // CheckedIn → InProgress (Nurse bắt đầu ca khám)
      // InProgress → Completed (kết thúc ca)
      // Approved/CheckedIn/InProgress → Cancelled (hủy)

      if (newStatus === 'CheckedIn') {
        // Cho phép check-in từ Approved hoặc từ No-Show
        if (!['Approved', 'No-Show'].includes(currentStatus)) {
          throw new Error(`Không thể check-in. Ca khám phải ở trạng thái "Approved" hoặc "No-Show" (hiện tại: ${currentStatus})`);
        }
        // Lưu thời gian check-in (hoặc cập nhật nếu đang chuyển lại từ No-Show)
        if (!appointment.checkedInAt) {
          appointment.checkedInAt = new Date();
          appointment.checkInByUserId = userId;
        }
      }

      if (newStatus === 'InProgress') {
        if (currentStatus !== 'CheckedIn') {
          throw new Error(`Không thể chuyển sang đang trong ca. Ca phải ở trạng thái "CheckedIn" (hiện tại: ${currentStatus})`);
        }
        appointment.inProgressAt = new Date();
        appointment.inProgressByUserId = userId;
      }

      if (newStatus === 'Completed') {
        if (!['CheckedIn', 'InProgress'].includes(currentStatus)) {
          throw new Error(`Không thể hoàn thành. Ca khám phải ở trạng thái "CheckedIn" hoặc "InProgress" (hiện tại: ${currentStatus})`);
        }
      }

      if (newStatus === 'Cancelled') {
        const allowedStatuses = ['Approved', 'CheckedIn', 'InProgress'];
        if (!allowedStatuses.includes(currentStatus)) {
          throw new Error(`Không thể hủy. Ca khám chỉ có thể hủy khi ở trạng thái Approved, CheckedIn hoặc InProgress (hiện tại: ${currentStatus})`);
        }
      }

      // Cập nhật trạng thái
      appointment.status = newStatus;
      appointment.updatedAt = new Date();

      // Lưu thông tin người thực hiện (Staff/Nurse)
      if (!appointment.updatedBy) {
        appointment.updatedBy = userId;
      }

      await appointment.save();

      // Nếu hủy thì mở lại timeslot để có thể đặt lại
      if (newStatus === 'Cancelled' && appointment.timeslotId) {
        try {
          await Timeslot.findByIdAndUpdate(appointment.timeslotId, {
            status: 'Available',
            appointmentId: null
          });
          console.log('🔓 Timeslot released due to status update → Cancelled');
        } catch (e) {
          console.error('⚠️ Không thể release timeslot khi cập nhật trạng thái:', e);
        }
      }

      console.log(`✅ Cập nhật trạng thái thành công: ${currentStatus} → ${newStatus}`);

      return {
        success: true,
        message: `Cập nhật trạng thái ca khám thành công: ${currentStatus} → ${newStatus}`,
        data: {
          appointmentId: appointment._id,
          oldStatus: currentStatus,
          newStatus: newStatus,
          updatedAt: appointment.updatedAt
        }
      };

    } catch (error) {
      console.error('❌ Lỗi cập nhật trạng thái ca khám:', error);
      throw error;
    }
  }

  /**
   * Hủy appointment
   */
  async cancelAppointment({ appointmentId, userId, cancelReason, bankInfo = null }) {
    try {
      console.log(`🔄 Hủy appointment ${appointmentId}`);
      console.log(`   - Type: ${typeof appointmentId}`);
      console.log(`   - Value: ${appointmentId}`);

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        throw new Error('Không tìm thấy lịch hẹn');
      }

      // Kiểm tra trạng thái có thể hủy được không
      const cancellableStatuses = ['Pending', 'Approved', 'PendingPayment'];
      if (!cancellableStatuses.includes(appointment.status)) {
        throw new Error('Lịch hẹn này không thể hủy được');
      }

      // Cập nhật thông tin hủy
      appointment.status = 'Cancelled';
      appointment.cancelReason = cancelReason || 'Người dùng hủy lịch hẹn';
      appointment.cancelledAt = new Date();
      appointment.updatedAt = new Date();
      
        // Lưu thông tin ngân hàng nếu có
        if (bankInfo) {
          appointment.bankInfo = {
            accountHolderName: bankInfo.accountHolderName || null,
            accountNumber: bankInfo.accountNumber || null,
            bankName: bankInfo.bankName || null
          };
        }

      await appointment.save();

      // ⭐ Release the reserved/booked timeslot so others can book it again
      if (appointment.timeslotId) {
        try {
          const timeslot = await Timeslot.findById(appointment.timeslotId);
          if (timeslot) {
            timeslot.status = 'Available';
            timeslot.appointmentId = null;
            await timeslot.save();
            console.log(`🔓 Timeslot ${timeslot._id} released back to Available`);
          }
        } catch (e) {
          console.error('⚠️ Không thể cập nhật trạng thái timeslot khi hủy lịch:', e);
        }
      }

      console.log(`✅ Hủy appointment thành công: ${appointmentId}`);

      return {
        success: true,
        message: 'Hủy lịch hẹn thành công',
        data: {
          appointmentId: appointment._id,
          status: appointment.status,
          cancelledAt: appointment.cancelledAt,
          cancelReason: appointment.cancelReason
        }
      };

    } catch (error) {
      console.error('❌ Lỗi hủy appointment:', error);
      throw error;
    }
  }

  // Lấy appointment by ID với đầy đủ thông tin
  async getAppointmentById(appointmentId) {
    try {
      const appointment = await Appointment.findById(appointmentId)
        .populate('serviceId', 'serviceName price')
        .populate('doctorUserId', 'fullName email phoneNumber')
        .populate('patientUserId', 'fullName email phoneNumber')
        .populate('timeslotId', 'startTime endTime')
        .populate('paymentId', 'amount method status')
        .lean();

      if (!appointment) {
        return null;
      }

      // Format dữ liệu để trả về
      return {
        _id: appointment._id,
        type: appointment.type,
        mode: appointment.mode,
        status: appointment.status,
        notes: appointment.notes,
        linkMeetUrl: appointment.linkMeetUrl,
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt,
        cancelledAt: appointment.cancelledAt,
        cancelReason: appointment.cancelReason,
        bankInfo: appointment.bankInfo,
        service: {
          _id: appointment.serviceId?._id,
          serviceName: appointment.serviceId?.serviceName,
          price: appointment.serviceId?.price
        },
        doctor: {
          _id: appointment.doctorUserId?._id,
          fullName: appointment.doctorUserId?.fullName,
          email: appointment.doctorUserId?.email,
          phoneNumber: appointment.doctorUserId?.phoneNumber
        },
        patient: {
          _id: appointment.patientUserId?._id,
          fullName: appointment.patientUserId?.fullName,
          email: appointment.patientUserId?.email,
          phoneNumber: appointment.patientUserId?.phoneNumber
        },
        timeslot: {
          _id: appointment.timeslotId?._id,
          startTime: appointment.timeslotId?.startTime,
          endTime: appointment.timeslotId?.endTime
        },
        payment: appointment.paymentId ? {
          _id: appointment.paymentId._id,
          amount: appointment.paymentId.amount,
          method: appointment.paymentId.method,
          status: appointment.paymentId.status
        } : null
      };
    } catch (error) {
      console.error('❌ Lỗi lấy appointment by ID:', error);
      throw error;
    }
  }

  // Lấy chi tiết lịch hẹn
  async getAppointmentDetails(appointmentId) {
    try {
      console.log(`🔍 Lấy chi tiết lịch hẹn: ${appointmentId}`);
      
      const appointment = await Appointment.findById(appointmentId)
        .populate('patientUserId', 'fullName email phone')
        .populate('customerId', 'fullName email phoneNumber')
        .populate('doctorUserId', 'fullName email phone')
        .populate('serviceId', 'serviceName price durationMinutes category')
        .populate('timeslotId', 'startTime endTime')
        .populate('paymentId', 'amount method status expiresAt QRurl')
        .populate('bankInfo', 'accountHolderName accountNumber bankName')
        .lean();

      if (!appointment) {
        throw new Error('Không tìm thấy lịch hẹn');
      }

      // Format dữ liệu trả về
      const formattedAppointment = {
        _id: appointment._id,
        status: appointment.status,
        type: appointment.type,
        mode: appointment.mode,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        notes: appointment.notes,
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt,
        checkedInAt: appointment.checkedInAt,
        completedAt: appointment.completedAt,
        cancelledAt: appointment.cancelledAt,
        cancelReason: appointment.cancelReason,
        patient: appointment.patientUserId ? {
          fullName: appointment.patientUserId.fullName,
          email: appointment.patientUserId.email,
          phone: appointment.patientUserId.phone
        } : null,
        customer: appointment.customerId ? {
          fullName: appointment.customerId.fullName,
          email: appointment.customerId.email,
          phone: appointment.customerId.phoneNumber
        } : null,
        doctor: appointment.doctorUserId ? {
          fullName: appointment.doctorUserId.fullName,
          email: appointment.doctorUserId.email,
          phone: appointment.doctorUserId.phone
        } : null,
        service: appointment.serviceId ? {
          serviceName: appointment.serviceId.serviceName,
          price: appointment.serviceId.price,
          durationMinutes: appointment.serviceId.durationMinutes,
          category: appointment.serviceId.category
        } : null,
        timeslot: appointment.timeslotId ? {
          startTime: appointment.timeslotId.startTime,
          endTime: appointment.timeslotId.endTime
        } : null,
        payment: appointment.paymentId ? {
          amount: appointment.paymentId.amount,
          method: appointment.paymentId.method,
          status: appointment.paymentId.status,
          expiresAt: appointment.paymentId.expiresAt,
          QRurl: appointment.paymentId.QRurl
        } : null,
        bankInfo: appointment.bankInfo ? {
          accountHolderName: appointment.bankInfo.accountHolderName,
          accountNumber: appointment.bankInfo.accountNumber,
          bankName: appointment.bankInfo.bankName
        } : null
      };

      console.log(`✅ Lấy chi tiết lịch hẹn thành công: ${appointmentId}`);
      return formattedAppointment;

    } catch (error) {
      console.error(`❌ Lỗi lấy chi tiết lịch hẹn ${appointmentId}:`, error);
      throw error;
    }
  }
}

module.exports = new AppointmentService();
