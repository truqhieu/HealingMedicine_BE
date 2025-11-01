const Appointment = require('../models/appointment.model');
const User = require('../models/user.model');
const Patient = require('../models/patient.model');

class NurseService {

  /**
   * Lấy danh sách lịch hẹn của TẤT CẢ các bác sĩ cho 2 tuần
   */
  async getNurseSchedule(nurseUserId) {
    // Kiểm tra có phải Nurse không
    const nurse = await User.findById(nurseUserId);
    if (!nurse || nurse.role !== 'Nurse') {
      throw new Error('Bạn không phải là điều dưỡng');
    }

    // Tính toán ngày bắt đầu tuần (Thứ 2)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const startOfWeek = new Date(today.setDate(diff));

    // Ngày kết thúc = 2 tuần từ đầu tuần (14 ngày)
    const endOfTwoWeeks = new Date(startOfWeek);
    endOfTwoWeeks.setDate(endOfTwoWeeks.getDate() + 14);

    // Lấy tất cả appointments trong 2 tuần
    const appointments = await Appointment.find({
      createdAt: {
        $gte: startOfWeek,
        $lt: endOfTwoWeeks
      },
      status: { $in: ['Approved', 'CheckedIn', 'InProgress', 'Completed', 'Finalized'] }
    })
      .populate({
        path: 'doctorUserId',
        select: 'fullName'
      })
      .populate({
        path: 'patientUserId',
        select: 'fullName'
      })
      .populate({
        path: 'customerId',
        select: 'fullName'
      })
      .populate({
        path: 'serviceId',
        select: 'serviceName'
      })
      .populate({
        path: 'timeslotId',
        select: 'startTime endTime'
      })
      .sort({ 'timeslotId.startTime': 1 })
      .lean();

    // Format response thành array dạng bảng
    return appointments.map(appointment => {
      const timeslot = appointment.timeslotId;
      const patient = appointment.patientUserId || appointment.customerId;

      return {
        appointmentId: appointment._id,
        patientId: patient?._id,
        doctorName: appointment.doctorUserId?.fullName || 'N/A',
        serviceName: appointment.serviceId?.serviceName || 'N/A',
        patientName: patient?.fullName || 'N/A',
        appointmentDate: timeslot?.startTime ? new Date(timeslot.startTime).toISOString().split('T')[0] : 'N/A',
        startTime: timeslot?.startTime ? new Date(timeslot.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A',
        endTime: timeslot?.endTime ? new Date(timeslot.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A',
        type: appointment.type,
        status: appointment.status,
        mode: appointment.mode
      };
    });
  }

  /**
   * Lấy chi tiết một lịch hẹn
   */
  async getAppointmentDetail(appointmentId) {
    const appointment = await Appointment.findById(appointmentId)
      .populate({
        path: 'doctorUserId',
        select: 'fullName'
      })
      .populate({
        path: 'patientUserId',
        select: 'fullName email'
      })
      .populate({
        path: 'customerId',
        select: 'fullName email'
      })
      .populate({
        path: 'serviceId',
        select: 'serviceName description'
      })
      .populate({
        path: 'timeslotId',
        select: 'startTime endTime'
      })
      .lean();

    if (!appointment) {
      throw new Error('Không tìm thấy lịch hẹn');
    }

    // Lấy thông tin bệnh nhân (từ Patient hoặc Customer)
    const patientInfo = appointment.patientUserId || appointment.customerId;
    const timeslot = appointment.timeslotId;

    return {
      appointmentId: appointment._id,
      doctorName: appointment.doctorUserId?.fullName || 'N/A',
      patientName: patientInfo?.fullName || 'N/A',
      patientEmail: patientInfo?.email || 'N/A',
      serviceName: appointment.serviceId?.serviceName || 'N/A',
      serviceDescription: appointment.serviceId?.description || '',
      type: appointment.type,
      status: appointment.status,
      mode: appointment.mode,
      appointmentDate: timeslot?.startTime ? new Date(timeslot.startTime).toISOString().split('T')[0] : 'N/A',
      startTime: timeslot?.startTime ? new Date(timeslot.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A',
      endTime: timeslot?.endTime ? new Date(timeslot.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : 'N/A'
    };
  }

  /**
   * Lấy chi tiết thông tin bệnh nhân
   */
  async getPatientDetail(patientId) {
    // Lấy thông tin từ User model (patientId là userId)
    const user = await User.findById(patientId)
      .select('fullName email phoneNumber dob gender address status')
      .lean();

    if (!user) {
      throw new Error('Không tìm thấy bệnh nhân');
    }

    // Lấy thông tin từ Patient model nếu có
    const patientRecord = await Patient.findOne({ patientUserId: patientId })
      .select('emergencyContact lastVisitDate')
      .lean();

    return {
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber || 'N/A',
      dateOfBirth: user.dob ? new Date(user.dob).toISOString().split('T')[0] : 'N/A',
      gender: user.gender || 'N/A',
      address: user.address || 'N/A',
      status: user.status,
      emergencyContact: patientRecord?.emergencyContact || 'N/A',
      lastVisitDate: patientRecord?.lastVisitDate ? new Date(patientRecord.lastVisitDate).toISOString().split('T')[0] : 'N/A'
    };
  }
}

module.exports = new NurseService();

