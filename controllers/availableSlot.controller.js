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

    // ⭐ IMPORTANT: Ensure appointmentFor always has a value (default to 'self')
    const appointmentForValue = appointmentFor || 'self';
    console.log('🔍 [generateSlotsByDate] appointmentFor received:', appointmentFor);
    console.log('🔍 [generateSlotsByDate] appointmentForValue (with default):', appointmentForValue);

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
    console.log('🔍 [generateSlotsByDate] appointmentFor:', appointmentForValue);
    if (appointmentForValue === 'other') {
      console.log('🔍 [generateSlotsByDate] Customer:', customerFullName, '<' + customerEmail + '>');
    }

    // ⭐⭐⭐ LOGIC:
    // - appointmentFor === 'self' (hoặc không specify): Pass userId để EXCLUDE slots user đã đặt
    // - appointmentFor === 'other': Không pass userId để KHÔNG exclude slots (chỉ exclude customer nếu có)
    const patientUserIdForExclusion = (appointmentForValue === 'self') && userId ? userId : null;
    console.log('🔍 [generateSlotsByDate] patientUserIdForExclusion:', patientUserIdForExclusion || 'none (will not exclude slots)');
    
    // ⭐ DEBUG: Show detailed info
    console.log('🔍 [generateSlotsByDate] DETAILED DEBUG:');
    console.log('   - appointmentForValue:', appointmentForValue);
    console.log('   - userId:', userId);
    console.log('   - appointmentForValue === "self":', appointmentForValue === 'self');
    console.log('   - Decision: patientUserIdForExclusion =', patientUserIdForExclusion === null ? 'null' : patientUserIdForExclusion);

    const result = await availableSlotService.generateAvailableSlotsByDate({
      serviceId,
      date: searchDate,
      breakAfterMinutes: breakAfterMinutes ? parseInt(breakAfterMinutes) : 10,
      patientUserId: patientUserIdForExclusion, // ⭐ Chỉ exclude khi appointmentFor === 'self'
      // ⭐ Pass customer info nếu appointmentFor === 'other'
      ...(appointmentForValue === 'other' && {
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
    const { serviceId, date, startTime, endTime, appointmentFor, userId } = req.query;

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

    // ⭐ THÊM: Log info
    console.log('🔍 [getAvailableDoctorsForTimeSlot]');
    console.log('   - appointmentFor:', appointmentFor || 'not specified');
    console.log('   - userId (from param):', userId || 'none');
    console.log('   - req.user?.userId:', req.user?.userId || 'none');

    // Get current user ID from auth middleware hoặc từ query param
    // ⭐ IMPORTANT: Khi appointmentFor === 'other', backend KHÔNG exclude doctors mà user đã đặt
    // Chỉ exclude khi appointmentFor === 'self'
    const patientUserId = req.user?.userId;
    const appointmentForValue = appointmentFor || 'self';
    
    // ⭐ FIX: Chỉ pass userIdForExclusion khi appointmentFor === 'self'
    // Khi appointmentFor === 'other', set patientUserId = null để KHÔNG exclude
    const userIdForExclusion = (appointmentForValue === 'self') ? (userId || patientUserId) : null;
    console.log('🔍 [getAvailableDoctorsForTimeSlot] userIdForExclusion:', userIdForExclusion || 'none');
    console.log('🔍 [getAvailableDoctorsForTimeSlot] appointmentForValue:', appointmentForValue);

    const result = await availableSlotService.getAvailableDoctorsForTimeSlot({
      serviceId,
      date: searchDate,
      startTime: slotStart,
      endTime: slotEnd,
      patientUserId: userIdForExclusion,
      appointmentFor: appointmentForValue
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

