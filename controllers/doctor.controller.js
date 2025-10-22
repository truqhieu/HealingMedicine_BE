const Appointment = require('../models/appointment.model');
const Timeslot = require('../models/timeslot.model');
const User = require('../models/user.model');

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
    const doctorUserId = req.user.userId;
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate({
        path: 'patientUserId',
        select: 'fullName email phoneNumber dob gender address'
      })
      .populate({
        path: 'customerId',
        select: 'fullName email phoneNumber dob gender address note'
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
    if (appointment.doctorUserId.toString() !== doctorUserId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem lịch hẹn này'
      });
    }

    // Lấy thông tin bệnh nhân (từ Patient hoặc Customer)
    const patientInfo = appointment.patientUserId || appointment.customerId;

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết lịch hẹn thành công',
      data: {
        appointmentId: appointment._id,
        type: appointment.type, // Consultation, Examination, FollowUp
        status: appointment.status, // Pending, Approved, CheckedIn, Completed, etc.
        mode: appointment.mode, // Online, Offline
        patient: patientInfo,
        service: appointment.serviceId,
        timeslot: appointment.timeslotId,
        payment: appointment.paymentId,
        notes: appointment.notes,
        linkMeetUrl: appointment.linkMeetUrl,
        rescheduleCount: appointment.rescheduleCount,
        replacedDoctorUserId: appointment.replacedDoctorUserId,
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt
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
    const doctorUserId = req.user.userId;
    const { patientId } = req.params;

    // Lấy thông tin bệnh nhân từ User model
    const patient = await User.findById(patientId)
      .select('fullName email phoneNumber dob gender address status')
      .lean();

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bệnh nhân'
      });
    }

    // Lấy danh sách tất cả lịch hẹn của bệnh nhân với bác sĩ này
    const appointmentHistory = await Appointment.find({
      patientUserId: patientId,
      doctorUserId: doctorUserId,
      status: { $in: ['Completed', 'Finalized'] } // Chỉ lấy những lịch đã hoàn tất
    })
      .populate({
        path: 'serviceId',
        select: 'serviceName price'
      })
      .populate({
        path: 'timeslotId',
        select: 'startTime endTime'
      })
      .select('type status notes createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Lấy danh sách lịch hẹn sắp tới
    const upcomingAppointments = await Appointment.find({
      patientUserId: patientId,
      doctorUserId: doctorUserId,
      status: { $in: ['Pending', 'Approved', 'CheckedIn'] } // Chưa hoàn tất
    })
      .populate({
        path: 'serviceId',
        select: 'serviceName'
      })
      .populate({
        path: 'timeslotId',
        select: 'startTime endTime'
      })
      .select('type status')
      .sort({ 'timeslotId.startTime': 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết thông tin bệnh nhân thành công',
      data: {
        patientId: patient._id,
        fullName: patient.fullName,
        email: patient.email,
        phoneNumber: patient.phoneNumber,
        dateOfBirth: patient.dob,
        gender: patient.gender,
        address: patient.address,
        status: patient.status,
        appointmentHistory: {
          total: appointmentHistory.length,
          list: appointmentHistory
        },
        upcomingAppointments: {
          total: upcomingAppointments.length,
          list: upcomingAppointments
        }
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
