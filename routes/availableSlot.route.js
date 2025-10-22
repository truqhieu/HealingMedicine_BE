const express = require('express');
const router = express.Router();
const { 
  getAvailableSlots,
  getAvailableDoctors,
  getAvailableDoctorsForTimeSlot
} = require('../controllers/availableSlot.controller');

// API lấy khung giờ available động cho một bác sĩ cụ thể - Public
router.get('/', getAvailableSlots);

//  API lấy danh sách tất cả bác sĩ có khung giờ rảnh vào một ngày cụ thể - Public
// GET /api/available-slots/doctors?serviceId=xxx&date=2025-10-21
router.get('/doctors/list', getAvailableDoctors);

// API lấy danh sách bác sĩ có khung giờ rảnh tại một khung giờ cụ thể - Public
router.get('/doctors/time-slot', getAvailableDoctorsForTimeSlot);

module.exports = router;

