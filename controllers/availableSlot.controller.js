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

    // ⭐⭐⭐ LOGIC:
    // - appointmentFor === 'self' (hoặc không specify): Pass userId để EXCLUDE slots user đã đặt
    // - appointmentFor === 'other': Không pass userId để KHÔNG exclude slots (chỉ exclude customer nếu có)
    // ⭐ KEY FIX: Chỉ exclude user's slots khi appointmentFor === 'self' hoặc KHÔNG được specify
    // 
    // ⭐ IMPORTANT: Nếu đặt cho người khác (appointmentFor === 'other'), PHẢI set patientUserIdForExclusion = null
    // Nếu không, backend sẽ vẫn exclude slots của user hiện tại, dẫn đến:
    // - User đặt cho bản thân lúc 8h (slot 8h-8:30 bị mark as booked)
    // - User chuyển sang "Đặt cho người khác"
    // - Backend vẫn loại bỏ slot 8h-8:30 vì patientUserId không được reset
    // - ❌ Kết quả: Slot 8h-8:30 không hiển thị dù người khác chưa đặt
    const patientUserIdForExclusion = appointmentFor === 'other' ? null : (userId || null);
    console.log('🔍 [generateSlotsByDate] appointmentFor type:', appointmentFor);
    console.log('🔍 [generateSlotsByDate] patientUserIdForExclusion:', patientUserIdForExclusion || 'none (will not exclude self slots)');
    console.log('🔍 [generateSlotsByDate] Reason:', appointmentFor === 'other' ? 'appointmentFor=other, so NOT excluding user slots' : 'appointmentFor=self or not specified, excluding user slots');

    const result = await availableSlotService.generateAvailableSlotsByDate({
      serviceId,
      date: searchDate,
      breakAfterMinutes: breakAfterMinutes ? parseInt(breakAfterMinutes) : 10,
      patientUserId: patientUserIdForExclusion, // ⭐ Chỉ exclude khi appointmentFor !== 'other'
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
    // ⭐ IMPORTANT: Khi appointmentFor === 'other', backend SẼ EXCLUDE doctors mà user đã đặt
    // Để tránh user vừa có 2 appointments cùng lúc với cùng 1 bác sĩ
    // (Nên GIỮ userId, không set = null!)
    const patientUserId = req.user?.userId;
    const userIdForExclusion = userId || patientUserId;
    console.log('🔍 [getAvailableDoctorsForTimeSlot] userIdForExclusion:', userIdForExclusion || 'none');

    const result = await availableSlotService.getAvailableDoctorsForTimeSlot({
      serviceId,
      date: searchDate,
      startTime: slotStart,
      endTime: slotEnd,
      patientUserId: userIdForExclusion,
      appointmentFor
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

