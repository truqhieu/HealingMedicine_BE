const express = require('express');
const router = express.Router();
const { createConsultationAppointment } = require('../controllers/appointment.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// API đặt lịch tư vấn - Yêu cầu đăng nhập
router.post('/consultation/create', verifyToken, createConsultationAppointment);

module.exports = router;
