const Appointment = require('../models/appointment.model');
const User = require('../models/user.model');

/**
 * Lấy danh sách lịch hẹn của TẤT CẢ các bác sĩ cho tuần hiện tại + tuần tiếp theo (2 tuần)
 * GET /api/nurse/appointments-schedule
 */
const getNurseSchedule = async (req, res) => {
  try {
    const nurseUserId = req.user.userId; // Từ token đã xác thực

    // Kiểm tra có phải Nurse không
    const nurse = await User.findById(nurseUserId);
    if (!nurse || nurse.role !== 'Nurse') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải là điều dưỡng'
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

    // Lấy tất cả appointments trong 2 tuần từ tất cả bác sĩ
    const appointments = await Appointment.find({
      createdAt: {
        $gte: startOfWeek,
        $lt: endOfTwoWeeks
      },
      status: { $ne: 'Cancelled' } // Không lấy những lịch đã hủy
    })
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
        select: 'serviceName price'
      })
      .populate({
        path: 'timeslotId',
        select: 'startTime endTime'
      })
      .sort({ 'timeslotId.startTime': 1 })
      .lean();

    // Nhóm lịch theo bác sĩ → theo ngày
    const appointmentsByDoctor = {};
    
    appointments.forEach(appointment => {
      const doctor = appointment.doctorUserId;
      const doctorKey = doctor._id.toString();
      
      if (!appointmentsByDoctor[doctorKey]) {
        appointmentsByDoctor[doctorKey] = {
          doctorInfo: {
            _id: doctor._id,
            fullName: doctor.fullName,
            email: doctor.email,
            specialization: doctor.specialization
          },
          appointmentsByDay: {}
        };
      }

      const timeslot = appointment.timeslotId;
      if (timeslot && timeslot.startTime) {
        const appointmentDate = new Date(timeslot.startTime);
        const dateKey = appointmentDate.toISOString().split('T')[0];
        
        if (!appointmentsByDoctor[doctorKey].appointmentsByDay[dateKey]) {
          appointmentsByDoctor[doctorKey].appointmentsByDay[dateKey] = [];
        }
        
        appointmentsByDoctor[doctorKey].appointmentsByDay[dateKey].push({
          appointmentId: appointment._id,
          type: appointment.type,
          status: appointment.status,
          startTime: timeslot.startTime,
          endTime: timeslot.endTime,
          patient: appointment.patientUserId || appointment.customerId,
          service: appointment.serviceId,
          notes: appointment.notes,
          mode: appointment.mode
        });
      }
    });

    // Tạo response
    return res.status(200).json({
      success: true,
      message: 'Lấy lịch khám thành công',
      data: {
        nurseName: nurse.fullName,
        nurseId: nurseUserId,
        periodStart: startOfWeek.toISOString().split('T')[0],
        periodEnd: new Date(endOfTwoWeeks.getTime() - 1).toISOString().split('T')[0],
        appointmentsByDoctor: appointmentsByDoctor,
        totalAppointments: appointments.length,
        totalDoctors: Object.keys(appointmentsByDoctor).length
      }
    });

  } catch (error) {
    console.error('Error in getNurseSchedule:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch khám',
      error: error.message
    });
  }
};

/**
 * Lấy chi tiết một lịch hẹn (xem ca khám)
 * GET /api/nurse/appointments/:appointmentId
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

    // Lấy thông tin bệnh nhân (từ Patient hoặc Customer)
    const patientInfo = appointment.patientUserId || appointment.customerId;

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết lịch hẹn thành công',
      data: {
        appointmentId: appointment._id,
        type: appointment.type,
        status: appointment.status,
        mode: appointment.mode,
        doctor: appointment.doctorUserId,
        patient: patientInfo,
        service: appointment.serviceId,
        timeslot: appointment.timeslotId,
        payment: appointment.paymentId,
        notes: appointment.notes,
        rescheduleCount: appointment.rescheduleCount,
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
 * GET /api/nurse/patients/:patientId
 */
const getPatientDetail = async (req, res) => {
  try {
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

    // Lấy danh sách tất cả lịch hẹn của bệnh nhân (từ tất cả bác sĩ)
    const appointmentHistory = await Appointment.find({
      patientUserId: patientId,
      status: { $in: ['Completed', 'Finalized'] }
    })
      .populate({
        path: 'doctorUserId',
        select: 'fullName specialization'
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
      status: { $in: ['Pending', 'Approved', 'CheckedIn'] }
    })
      .populate({
        path: 'doctorUserId',
        select: 'fullName specialization'
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
  getNurseSchedule,
  getAppointmentDetail,
  getPatientDetail
};
