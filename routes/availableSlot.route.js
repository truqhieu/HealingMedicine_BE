const express = require('express');
const router = express.Router();
const { 
  generateSlotsByDate,
  getAvailableSlots,
  getAvailableDoctors,
  getAvailableDoctorsForTimeSlot,
  getAvailableStartTimes,
  checkStartTimeAvailability,
  getAvailableTimeRange,
  validateAndCheckStartTime
} = require('../controllers/availableSlot.controller');
const { optionalAuth } = require('../middleware/auth.middleware');

// ⭐ NEW: Generate danh sách khung giờ cho một ngày (không cần bác sĩ)
// GET /api/available-slots/generate?serviceId=xxx&date=2025-10-25
// optionalAuth: Nếu user đã login thì exclude slots đã đặt
router.get('/generate', optionalAuth, generateSlotsByDate);

// API lấy khung giờ available động cho một bác sĩ cụ thể - Public
// GET /api/available-slots?doctorUserId=xxx&serviceId=xxx&date=2025-10-25
router.get('/', getAvailableSlots);

//  API lấy danh sách tất cả bác sĩ có khung giờ rảnh vào một ngày cụ thể - Public
// GET /api/available-slots/doctors/list?serviceId=xxx&date=2025-10-25
router.get('/doctors/list', getAvailableDoctors);

// API lấy danh sách bác sĩ có khung giờ rảnh tại một khung giờ cụ thể - Public
// GET /api/available-slots/doctors/time-slot?serviceId=xxx&date=2025-10-25&startTime=2025-10-25T08:00:00Z&endTime=2025-10-25T08:30:00Z
router.get('/doctors/time-slot', getAvailableDoctorsForTimeSlot);

// ⭐ NEW: Lấy danh sách start times có sẵn cho một ngày
// GET /api/available-slots/start-times?serviceId=xxx&date=2025-10-25
router.get('/start-times', optionalAuth, getAvailableStartTimes);

// ⭐ NEW: Kiểm tra một start time cụ thể có khả dụng không, lấy danh sách bác sĩ
// GET /api/available-slots/check-start-time?serviceId=xxx&date=2025-10-25&startTime=2025-10-25T08:00:00Z
router.get('/check-start-time', optionalAuth, checkStartTimeAvailability);

// ⭐ NEW: Lấy khoảng thời gian khả dụng (min-max time)
// GET /api/available-slots/time-range?serviceId=xxx&date=2025-10-25
router.get('/time-range', optionalAuth, getAvailableTimeRange);

// ⭐ NEW: Validate thời gian nhập có hợp lệ không
// GET /api/available-slots/validate-time?serviceId=xxx&date=2025-10-25&startTime=2025-10-25T09:45:00Z
router.get('/validate-time', optionalAuth, validateAndCheckStartTime);

module.exports = router;

