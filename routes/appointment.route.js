const express = require('express');
const router = express.Router();
const { 
  createConsultationAppointment, 
  reviewAppointment,
  getPendingAppointments,
  getAllAppointments 
} = require('../controllers/appointment.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// API đặt lịch tư vấn - Yêu cầu đăng nhập
router.post('/consultation/create', verifyToken, createConsultationAppointment);

// ⭐ API duyệt hoặc hủy lịch hẹn - Unified endpoint
router.post('/review', verifyToken, reviewAppointment);

// API lấy danh sách lịch hẹn chờ duyệt
router.get('/pending', verifyToken, getPendingAppointments);

// API lấy danh sách tất cả lịch hẹn (có filter)
router.get('/all', verifyToken, getAllAppointments);

module.exports = router;
