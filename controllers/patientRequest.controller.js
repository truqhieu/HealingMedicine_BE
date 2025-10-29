const PatientRequest = require('../models/patientRequest.model');
const Appointment = require('../models/appointment.model');
const Timeslot = require('../models/timeslot.model');
const User = require('../models/user.model');
const emailService = require('../services/email.service');

// ⭐ Lấy danh sách tất cả yêu cầu của bệnh nhân (cho staff)
const getAllPatientRequests = async (req, res) => {
  try {
    const { status, requestType, page = 1, limit = 10 } = req.query;
    
    // Tạo filter
    const filter = {};
    if (status) filter.status = status;
    if (requestType) filter.requestType = requestType;
    
    // Pagination
    const skip = (page - 1) * limit;
    
    const requests = await PatientRequest.find(filter)
      .populate('appointmentId', 'serviceId patientUserId doctorUserId timeslotId status')
      .populate('patientUserId', 'fullName email phone')
      .populate('currentData.doctorUserId', 'fullName')
      .populate('requestedData.doctorUserId', 'fullName')
      .populate('currentData.timeslotId', 'startTime endTime')
      .populate('requestedData.timeslotId', 'startTime endTime')
      .populate('staffResponse.staffUserId', 'fullName')
      .populate({
        path: 'appointmentId',
        populate: {
          path: 'serviceId',
          select: 'serviceName'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await PatientRequest.countDocuments(filter);
    
    return res.status(200).json({
      success: true,
      data: {
        requests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error in getAllPatientRequests:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách yêu cầu',
      error: error.message
    });
  }
};

// ⭐ Lấy chi tiết một yêu cầu
const getPatientRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const request = await PatientRequest.findById(requestId)
      .populate('appointmentId', 'serviceId patientUserId doctorUserId timeslotId status')
      .populate('patientUserId', 'fullName email phone')
      .populate('currentData.doctorUserId', 'fullName')
      .populate('requestedData.doctorUserId', 'fullName')
      .populate('currentData.timeslotId', 'startTime endTime')
      .populate('requestedData.timeslotId', 'startTime endTime')
      .populate('staffResponse.staffUserId', 'fullName')
      .populate({
        path: 'appointmentId',
        populate: {
          path: 'serviceId',
          select: 'serviceName'
        }
      });
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: request
    });
    
  } catch (error) {
    console.error('❌ Error in getPatientRequestById:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy chi tiết yêu cầu',
      error: error.message
    });
  }
};

// ⭐ Duyệt yêu cầu (chấp nhận)
const approveRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const staffUserId = req.user?.userId;
    
    const request = await PatientRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu'
      });
    }
    
    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Yêu cầu đã được xử lý'
      });
    }
    
    // Cập nhật appointment theo yêu cầu
    const appointment = await Appointment.findById(request.appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }
    
    // Cập nhật dữ liệu appointment
    if (request.requestType === 'Reschedule') {
      // Lấy timeslot đã reserved
      const slot = await Timeslot.findById(request.requestedData.timeslotId);
      
      if (!slot) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy timeslot đã đặt trước'
        });
      }

      // Chuyển status từ Reserved thành Booked
      slot.status = 'Booked';
      slot.appointmentId = appointment._id;
      await slot.save();

      // Cập nhật appointment
      appointment.timeslotId = slot._id;
      appointment.rescheduleCount = (appointment.rescheduleCount || 0) + 1;
    } else if (request.requestType === 'ChangeDoctor') {
      // Lấy timeslot đã reserved cho bác sĩ mới
      const slot = await Timeslot.findById(request.requestedData.timeslotId);
      
      if (!slot) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy timeslot đã đặt trước cho bác sĩ mới'
        });
      }

      // Chuyển status từ Reserved thành Booked
      slot.status = 'Booked';
      slot.appointmentId = appointment._id;
      await slot.save();

      // Cập nhật appointment với bác sĩ mới và timeslot mới
      appointment.doctorUserId = request.requestedData.doctorUserId;
      appointment.timeslotId = slot._id;
    }
    
    await appointment.save();
    
    // Cập nhật request status
    request.status = 'Approved';
    request.staffResponse = {
      staffUserId,
      response: 'Approved',
      respondedAt: new Date()
    };
    
    await request.save();
    
    // Gửi email thông báo cho bệnh nhân
    try {
      const patient = await User.findById(request.patientUserId);
      const staff = await User.findById(staffUserId);
      
      if (patient && patient.email) {
        const emailData = {
          to: patient.email,
          subject: `Yêu cầu ${request.requestType === 'Reschedule' ? 'đổi lịch hẹn' : 'đổi bác sĩ'} đã được duyệt`,
          template: 'requestApproved',
          data: {
            patientName: patient.fullName,
            requestType: request.requestType === 'Reschedule' ? 'đổi lịch hẹn' : 'đổi bác sĩ',
            staffName: staff?.fullName || 'Nhân viên',
            approvedAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
            appointmentId: appointment._id
          }
        };
        
        await emailService.sendEmail(emailData);
        console.log(`✅ Email sent to ${patient.email} for approved request`);
      }
    } catch (emailError) {
      console.error('❌ Error sending approval email:', emailError);
      // Không throw error để không ảnh hưởng đến response chính
    }
    
    return res.status(200).json({
      success: true,
      message: 'Duyệt yêu cầu thành công',
      data: request
    });
    
  } catch (error) {
    console.error('❌ Error in approveRequest:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi duyệt yêu cầu',
      error: error.message
    });
  }
};

// ⭐ Từ chối yêu cầu
const rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const staffUserId = req.user?.userId;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp lý do từ chối'
      });
    }
    
    const request = await PatientRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu'
      });
    }
    
    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Yêu cầu đã được xử lý'
      });
    }
    
    // Nếu là yêu cầu đổi lịch hoặc đổi bác sĩ, chuyển timeslot về Available
    if ((request.requestType === 'Reschedule' || request.requestType === 'ChangeDoctor') && request.requestedData.timeslotId) {
      const slot = await Timeslot.findById(request.requestedData.timeslotId);
      if (slot && slot.status === 'Reserved') {
        slot.status = 'Available';
        slot.appointmentId = null;
        await slot.save();
      }
    }

    // Cập nhật request status
    request.status = 'Rejected';
    request.staffResponse = {
      staffUserId,
      response: 'Rejected',
      reason,
      respondedAt: new Date()
    };
    
    await request.save();
    
    // Gửi email thông báo cho bệnh nhân
    try {
      const patient = await User.findById(request.patientUserId);
      const staff = await User.findById(staffUserId);
      
      if (patient && patient.email) {
        const emailData = {
          to: patient.email,
          subject: `Yêu cầu ${request.requestType === 'Reschedule' ? 'đổi lịch hẹn' : 'đổi bác sĩ'} đã bị từ chối`,
          template: 'requestRejected',
          data: {
            patientName: patient.fullName,
            requestType: request.requestType === 'Reschedule' ? 'đổi lịch hẹn' : 'đổi bác sĩ',
            staffName: staff?.fullName || 'Nhân viên',
            rejectedAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
            reason: reason,
            appointmentId: request.appointmentId
          }
        };
        
        await emailService.sendEmail(emailData);
        console.log(`✅ Email sent to ${patient.email} for rejected request`);
      }
    } catch (emailError) {
      console.error('❌ Error sending rejection email:', emailError);
      // Không throw error để không ảnh hưởng đến response chính
    }
    
    return res.status(200).json({
      success: true,
      message: 'Từ chối yêu cầu thành công',
      data: request
    });
    
  } catch (error) {
    console.error('❌ Error in rejectRequest:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi từ chối yêu cầu',
      error: error.message
    });
  }
};

module.exports = {
  getAllPatientRequests,
  getPatientRequestById,
  approveRequest,
  rejectRequest
};
