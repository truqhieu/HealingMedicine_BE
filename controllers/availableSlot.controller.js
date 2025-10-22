const availableSlotService = require('../services/availableSlot.service');

/**
 * ⭐ NEW: Generate danh sách khung giờ trống cho một ngày
 * GET /api/available-slots/generate?serviceId=xxx&date=2025-10-25
 * Dùng để FE hiển thị các slot khả dụng sau khi chọn dịch vụ + ngày
 */
const generateSlotsByDate = async (req, res) => {
  try {
    const { serviceId, date, breakAfterMinutes, appointmentFor, customerFullName, customerEmail } = req.query;
    const userId = req.user?.userId || null; // Lấy userId nếu user đã login

    // Validation
    if (!serviceId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ serviceId và date'
      });
    }

    // Validate date format
    const searchDate = new Date(date);
    if (isNaN(searchDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng ngày không hợp lệ. Vui lòng sử dụng format: YYYY-MM-DD'
      });
    }

    console.log('🔍 [generateSlotsByDate] User ID:', userId ? userId : 'Guest');
    console.log('🔍 [generateSlotsByDate] appointmentFor:', appointmentFor || 'not specified');
    if (appointmentFor === 'other') {
      console.log('🔍 [generateSlotsByDate] Customer:', customerFullName, '<' + customerEmail + '>');
    }

    // ⭐ Chỉ pass userId nếu appointmentFor === 'self' hoặc không specify (default là self)
    // Nếu appointmentFor === 'other', không pass userId để không exclude
    const patientUserIdForExclusion = (appointmentFor === 'self' || !appointmentFor) && userId ? userId : null;

    const result = await availableSlotService.generateAvailableSlotsByDate({
      serviceId,
      date: searchDate,
      breakAfterMinutes: breakAfterMinutes ? parseInt(breakAfterMinutes) : 10,
      patientUserId: patientUserIdForExclusion, // ⭐ Chỉ exclude khi appointmentFor === 'self'
      // ⭐ Pass customer info nếu appointmentFor === 'other'
      ...(appointmentFor === 'other' && {
        customerFullName: customerFullName ? decodeURIComponent(customerFullName) : null,
        customerEmail: customerEmail ? decodeURIComponent(customerEmail) : null,
      }),
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Lỗi generate slots by date:', error);

    if (error.message.includes('Không tìm thấy') ||
        error.message.includes('không hoạt động') ||
        error.message.includes('Vui lòng cung cấp')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server khi generate danh sách khung giờ',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Lấy danh sách khung giờ available động
 * GET /api/available-slots?doctorUserId=xxx&serviceId=yyy&date=2025-10-21
 */
const getAvailableSlots = async (req, res) => {
  try {
    const { doctorUserId, serviceId, date, breakAfterMinutes } = req.query;

    // Validation
    if (!doctorUserId || !serviceId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ doctorUserId, serviceId và date'
      });
    }

    // Validate date format
    const searchDate = new Date(date);
    if (isNaN(searchDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng ngày không hợp lệ. Vui lòng sử dụng format: YYYY-MM-DD'
      });
    }

    // Get current user ID from auth middleware
    const patientUserId = req.user?.userId;

    const result = await availableSlotService.getAvailableSlots({
      doctorUserId,
      serviceId,
      date: searchDate,
      patientUserId,
      breakAfterMinutes: breakAfterMinutes ? parseInt(breakAfterMinutes) : 10
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Lỗi lấy available slots:', error);

    if (error.message.includes('Không tìm thấy') ||
        error.message.includes('không hoạt động') ||
        error.message.includes('Vui lòng cung cấp')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách khung giờ available',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Lấy danh sách tất cả bác sĩ có khung giờ rảnh vào ngày cụ thể
 * GET /api/available-slots/doctors?serviceId=xxx&date=2025-10-21
 */
const getAvailableDoctors = async (req, res) => {
  try {
    const { serviceId, date, breakAfterMinutes } = req.query;

    // Validation
    if (!serviceId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ serviceId và date'
      });
    }

    // Validate date format
    const searchDate = new Date(date);
    if (isNaN(searchDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng ngày không hợp lệ. Vui lòng sử dụng format: YYYY-MM-DD'
      });
    }

    const result = await availableSlotService.getAvailableDoctors({
      serviceId,
      date: searchDate,
      breakAfterMinutes: breakAfterMinutes ? parseInt(breakAfterMinutes) : 10
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Lỗi lấy danh sách bác sĩ có khung giờ rảnh:', error);

    if (error.message.includes('Không tìm thấy') ||
        error.message.includes('không hoạt động') ||
        error.message.includes('Vui lòng cung cấp')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách bác sĩ',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Lấy danh sách bác sĩ có khung giờ rảnh tại một khung giờ cụ thể
 * GET /api/available-slots/doctors/time-slot?serviceId=xxx&date=2025-10-21&startTime=2025-10-21T09:00:00Z&endTime=2025-10-21T09:30:00Z
 */
const getAvailableDoctorsForTimeSlot = async (req, res) => {
  try {
    const { serviceId, date, startTime, endTime } = req.query;

    // Validation
    if (!serviceId || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ serviceId, date, startTime và endTime'
      });
    }

    // Validate date format
    const searchDate = new Date(date);
    if (isNaN(searchDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng ngày không hợp lệ. Vui lòng sử dụng format: YYYY-MM-DD'
      });
    }

    const slotStart = new Date(startTime);
    const slotEnd = new Date(endTime);

    if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Định dạng startTime hoặc endTime không hợp lệ. Vui lòng sử dụng format ISO 8601'
      });
    }

    if (slotStart >= slotEnd) {
      return res.status(400).json({
        success: false,
        message: 'startTime phải nhỏ hơn endTime'
      });
    }

    // Get current user ID from auth middleware
    const patientUserId = req.user?.userId;

    const result = await availableSlotService.getAvailableDoctorsForTimeSlot({
      serviceId,
      date: searchDate,
      startTime: slotStart,
      endTime: slotEnd,
      patientUserId
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Lỗi lấy danh sách bác sĩ cho khung giờ cụ thể:', error);
    console.error('Error message:', error.message);

    if (error.message.includes('Không tìm thấy') ||
        error.message.includes('không hoạt động') ||
        error.message.includes('Vui lòng cung cấp') ||
        error.message.includes('không khớp')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách bác sĩ',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  generateSlotsByDate,
  getAvailableSlots,
  getAvailableDoctors,
  getAvailableDoctorsForTimeSlot
};

