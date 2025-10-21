const Appointment = require('../models/appointment.model');
const Timeslot = require('../models/timeslot.model');
const Service = require('../models/service.model');
const User = require('../models/user.model');
const Customer = require('../models/customer.model');
const DoctorSchedule = require('../models/doctorSchedule.model');

class AppointmentService {

  async createConsultationAppointment(appointmentData) {
    const {
      patientUserId,
      doctorUserId,
      serviceId,
      doctorScheduleId,
      selectedSlot, // { startTime, endTime } từ available slots
      consultationType,
      notes,
      phoneNumber,
      appointmentFor
    } = appointmentData;

    // Validate required fields
    if (!patientUserId || !doctorUserId || !serviceId || !doctorScheduleId || !selectedSlot) {
      throw new Error('Thiếu thông tin bắt buộc để đặt lịch tư vấn');
    }

    if (!selectedSlot.startTime || !selectedSlot.endTime) {
      throw new Error('Thông tin khung giờ không hợp lệ');
    }

    // Kiểm tra patient có tồn tại không và lấy thông tin email
    const patient = await User.findById(patientUserId);
    if (!patient) {
      throw new Error('Người dùng không tồn tại');
    }

    // Kiểm tra service có tồn tại không
    const service = await Service.findById(serviceId);
    if (!service) {
      throw new Error('Dịch vụ không tồn tại');
    }

    if (service.status !== 'Active') {
      throw new Error('Dịch vụ này hiện không khả dụng');
    }

    // Kiểm tra nếu service yêu cầu thanh toán trước (Consultation)
    if (service.isPrepaid && service.category === 'Consultation') {
      // TODO: Sẽ implement logic thanh toán sau
      // Hiện tại chỉ log để biết service này cần thanh toán trước
      console.log('⚠️ Service này yêu cầu thanh toán trước:', service.serviceName);
      console.log('💰 Giá:', service.price, 'VND');
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
    
    // Formdata lấy từ request
    const formData = { phoneNumber, appointmentFor };
    if (formData?.appointmentFor === 'other') {
      // TODO: Lấy customerId từ request
      customerId = null; // Tạm thời null
    }

    if (formData.phoneNumber) {
      console.log('   - SĐT:', formData.phoneNumber);
    }

    // ⭐ THÊM: CHECK TIMESLOT TRƯỚC KHI TẠO ❌
    // Để tránh race condition: 2 request cùng lúc
    const existingTimeslot = await Timeslot.findOne({
      startTime: new Date(selectedSlot.startTime),
      endTime: new Date(selectedSlot.endTime),
      doctorUserId: doctorUserId,
      status: { $in: ['Reserved', 'Booked'] } // Chỉ block nếu đang được giữ hoặc booked
    });

    if (existingTimeslot) {
      console.log('❌ Khung giờ đã bị book/reserved:', existingTimeslot._id);
      throw new Error(`Khung giờ này đã được đặt hoặc đang chờ thanh toán. Vui lòng chọn khung giờ khác.`);
    }

    // Validate selectedSlot duration phải khớp với service duration
    const slotStartTime = new Date(selectedSlot.startTime);
    const slotEndTime = new Date(selectedSlot.endTime);
    const slotDurationMinutes = (slotEndTime - slotStartTime) / 60000;

    if (slotDurationMinutes !== service.durationMinutes) {
      throw new Error(
        `Khung giờ không hợp lệ. Dịch vụ "${service.serviceName}" yêu cầu ${service.durationMinutes} phút, ` +
        `nhưng slot được chọn chỉ có ${slotDurationMinutes} phút`
      );
    }

    // Kiểm tra doctor schedule
    const schedule = await DoctorSchedule.findById(doctorScheduleId);
    if (!schedule) {
      throw new Error('Lịch làm việc của bác sĩ không tồn tại');
    }

    // Kiểm tra khung giờ có bị trùng không
    // Check cả timeslot đã booked VÀ appointment đang pending payment
    const conflictTimeslot = await Timeslot.findOne({
      doctorUserId,
      status: 'Booked',
      $or: [
        {
          startTime: { $lt: new Date(selectedSlot.endTime) },
          endTime: { $gt: new Date(selectedSlot.startTime) }
        }
      ]
    });

    if (conflictTimeslot) {
      // Kiểm tra xem timeslot này có appointment pending payment không
      if (conflictTimeslot.appointmentId) {
        const conflictAppointment = await Appointment.findById(conflictTimeslot.appointmentId);
        
        if (conflictAppointment) {
          // Nếu appointment đang pending payment và chưa hết hạn
          if (conflictAppointment.status === 'PendingPayment') {
            if (conflictAppointment.paymentHoldExpiresAt && 
                conflictAppointment.paymentHoldExpiresAt > new Date()) {
              throw new Error('Khung giờ này đang được giữ chờ thanh toán. Vui lòng chọn khung giờ khác hoặc thử lại sau ít phút.');
            } else {
              // Appointment đã hết hạn, có thể xóa và cho đặt lại
              console.log('⏰ Appointment hết hạn, tự động hủy:', conflictAppointment._id);
              await Appointment.findByIdAndUpdate(conflictAppointment._id, {
                status: 'Expired',
                cancelReason: 'Không thanh toán trong thời gian quy định'
              });
              await Timeslot.findByIdAndUpdate(conflictTimeslot._id, {
                status: 'Available',
                appointmentId: null
              });
            }
          } else {
            // Appointment đã confirmed hoặc approved
            throw new Error('Khung giờ này đã được đặt. Vui lòng chọn khung giờ khác');
          }
        }
      } else {
        throw new Error('Khung giờ này đã được đặt. Vui lòng chọn khung giờ khác');
      }
    }

    // Kiểm tra doctor có tồn tại không (từ bảng User với role="Doctor")
    const doctor = await User.findById(doctorUserId);
    if (!doctor) {
      throw new Error('Không tìm thấy bác sĩ');
    }

    if (doctor.role !== 'Doctor') {
      throw new Error('User này không phải là bác sĩ');
    }

    if (doctor.status !== 'Active') {
      throw new Error('Bác sĩ này hiện không hoạt động');
    }

    // Log thông tin để kiểm tra
    console.log('📋 Thông tin đặt lịch:');
    console.log('- Service:', service.serviceName);
    console.log('- Category:', service.category);
    console.log('- isPrepaid:', service.isPrepaid);
    console.log('- Mode được set:', appointmentMode);
    console.log('- Họ tên từ form:', formData?.fullName);
    console.log('- SĐT từ form:', formData?.phoneNumber);
    console.log('- Email từ user đăng nhập:', patient.email);
    console.log('- Đặt cho:', formData?.appointmentFor || 'self');

    // Nếu đặt cho người khác, tạo Customer
    if (formData?.appointmentFor === 'other') {
      if (!formData?.fullName || !formData?.email || !formData?.phoneNumber) {
        throw new Error('Vui lòng nhập đầy đủ họ tên, email và số điện thoại của người được đặt lịch (customer)');
      }

      // Tạo Customer mới
      const newCustomer = await Customer.create({
        patientUserId: patientUserId, 
        fullName: formData.fullName,
        email: formData.email, 
        phoneNumber: formData.phoneNumber,
        hasAccount: false,
        linkedUserId: null
      });

      customerId = newCustomer._id;
      console.log('✅ Đã tạo Customer cho người được đặt lịch:');
      console.log('   - Customer ID:', newCustomer._id);
      console.log('   - Họ tên:', formData.fullName);
      console.log('   - Email:', formData.email);
      console.log('   - SĐT:', formData.phoneNumber);
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
      // Nếu cần thanh toán trước, set status PendingPayment và expire sau 15 phút
      appointmentStatus = 'PendingPayment';
      paymentHoldExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
      console.log('💳 Appointment cần thanh toán trước, giữ slot đến:', paymentHoldExpiresAt);
    }

    // Tạo appointment mới
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
      paymentHoldExpiresAt: paymentHoldExpiresAt
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
        amount: service.price,
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
      console.log('💰 Số tiền cần thanh toán:', service.price, 'VND');
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

    return populatedAppointment;
  }
}

module.exports = new AppointmentService();
