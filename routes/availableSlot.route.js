const express = require('express');
const router = express.Router();
const { getAvailableSlots } = require('../controllers/availableSlot.controller');

// API lấy khung giờ available động - Public (để user xem khi đặt lịch)
router.get('/', getAvailableSlots);

module.exports = router;

