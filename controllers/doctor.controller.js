const Appointment = require('../models/appointment.model');
const Timeslot = require('../models/timeslot.model');
const User = require('../models/user.model');
const Patient = require('../models/patient.model');

/**
 * Lấy danh sách lịch hẹn của bác sĩ cho tuần hiện tại + tuần tiếp theo (2 tuần)
 * GET /api/doctor/appointments-schedule
 * Format: Array dạng bảng để UI hiển thị
 */
const getDoctorAppointmentsSchedule = async (req, res) => {
  try {
    const doctorUserId = req.user.userId; // Từ token đã xác thực

    // Kiểm tra bác sĩ có tồn tại không
    const doctor = await User.findById(doctorUserId);
    if (!doctor || doctor.role !== 'Doctor') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải là bác sĩ'
      });
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
      doctorUserId: doctorUserId,
      createdAt: {
        $gte: startOfWeek,
        $lt: endOfTwoWeeks
      },
      // ⭐ Chỉ hiển thị ca khám đã được Staff duyệt (Approved, CheckedIn, Completed, Finalized)
      // Các ca Pending vẫn ở màn Staff nên không show
      status: { $in: ['Approved', 'CheckedIn', 'Completed', 'Finalized'] }
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

    // ⭐ Format response thành array dạng bảng
    const appointmentsList = appointments.map(appointment => {
      const timeslot = appointment.timeslotId;
      const patient = appointment.patientUserId || appointment.customerId;
      
      return {
        appointmentId: appointment._id,
        serviceName: appointment.serviceId?.serviceName || 'N/A',
        patientName: patient?.fullName || 'N/A',
        appointmentDate: timeslot?.startTime ? new Date(timeslot.startTime).toISOString().split('T')[0] : 'N/A',
        startTime: timeslot?.startTime ? new Date(timeslot.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        endTime: timeslot?.endTime ? new Date(timeslot.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        type: appointment.type,
        status: appointment.status,
        mode: appointment.mode
      };
    });

    // Tạo response
    return res.status(200).json({
      success: true,
      message: 'Lấy lịch khám thành công',
      data: appointmentsList  // ⭐ Chỉ trả về mảng appointments
    });

  } catch (error) {
    console.error('Error in getDoctorAppointmentsSchedule:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch khám',
      error: error.message
    });
  }
};

/**
 * Lấy chi tiết một lịch hẹn
 * GET /api/doctor/appointments/:appointmentId
 */
const getAppointmentDetail = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate({
        path: 'doctorUserId',
        select: 'fullName email specialization'
      })
      .populate({
        path: 'patientUserId',
        select: 'fullName email phoneNumber'
      })
      .populate({
        path: 'customerId',
        select: 'fullName email phoneNumber'
      })
      .populate({
        path: 'serviceId',
        select: 'serviceName price description'
      })
      .populate({
        path: 'timeslotId',
        select: 'startTime endTime'
      })
      .populate({
        path: 'paymentId',
        select: 'status amount method'
      })
      .lean();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Kiểm tra xem bác sĩ có phải là bác sĩ của lịch hẹn này không
    if (appointment.doctorUserId._id.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem lịch hẹn này'
      });
    }

    // Lấy thông tin bệnh nhân (từ Patient hoặc Customer)
    const patientInfo = appointment.patientUserId || appointment.customerId;
    const timeslot = appointment.timeslotId;

    // ⭐ Format response gọn gàng
    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết lịch hẹn thành công',
      data: {
        appointmentId: appointment._id,
        patientId: patientInfo?._id || 'N/A',
        patientName: patientInfo?.fullName || 'N/A',
        patientEmail: patientInfo?.email || 'N/A',
        serviceName: appointment.serviceId?.serviceName || 'N/A',
        serviceDescription: appointment.serviceId?.description || '',
        type: appointment.type,
        status: appointment.status,
        mode: appointment.mode,
        appointmentDate: timeslot?.startTime ? new Date(timeslot.startTime).toISOString().split('T')[0] : 'N/A',
        startTime: timeslot?.startTime ? new Date(timeslot.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        endTime: timeslot?.endTime ? new Date(timeslot.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'
      }
    });

  } catch (error) {
    console.error('Error in getAppointmentDetail:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết lịch hẹn',
      error: error.message
    });
  }
};

/**
 * Lấy chi tiết thông tin bệnh nhân
 * GET /api/doctor/patients/:patientId
 */
const getPatientDetail = async (req, res) => {
  try {
    const { patientId } = req.params;

    // ⭐ Lấy thông tin từ User model (patientId là userId)
    const user = await User.findById(patientId)
      .select('fullName email phoneNumber dob gender address status')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bệnh nhân'
      });
    }

    // ⭐ Lấy thông tin từ Patient model nếu có
    const patientRecord = await Patient.findOne({ patientUserId: patientId })
      .select('emergencyContact lastVisitDate')
      .lean();

    // ⭐ Format response gọn gàng
    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết thông tin bệnh nhân thành công',
      data: {
        patientId: user._id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber || 'N/A',
        dateOfBirth: user.dob ? new Date(user.dob).toISOString().split('T')[0] : 'N/A',
        gender: user.gender || 'N/A',
        address: user.address || 'N/A',
        status: user.status,
        emergencyContact: patientRecord?.emergencyContact || 'N/A',
        lastVisitDate: patientRecord?.lastVisitDate ? new Date(patientRecord.lastVisitDate).toISOString().split('T')[0] : 'N/A'
      }
    });

  } catch (error) {
    console.error('Error in getPatientDetail:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin bệnh nhân',
      error: error.message
    });
  }
};

module.exports = {
  getDoctorAppointmentsSchedule,
  getAppointmentDetail,
  getPatientDetail
};
