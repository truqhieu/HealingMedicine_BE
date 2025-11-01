const express = require('express');
const router = express.Router();
const { updateWorkingHours, getWorkingHours, updateDoctorWorkingHoursForDate, getDoctorsWithWorkingHours, updateDoctorWorkingHours } = require('../controllers/schedule.controller');
const { verifyToken, verifyRole } = require('../middleware/auth.middleware');

// Routes for doctor working hours management
router.get('/schedules/doctors-with-working-hours', verifyToken, verifyRole('Manager'), getDoctorsWithWorkingHours);
router.put('/schedules/doctor/:doctorId/working-hours', verifyToken, verifyRole('Manager'), updateDoctorWorkingHours);

// Working Hours routes
router.get('/schedules/:scheduleId/working-hours', verifyToken, verifyRole('Manager'), getWorkingHours);
router.put('/schedules/:scheduleId/working-hours', verifyToken, verifyRole('Manager'), updateWorkingHours);
router.put('/schedules/doctor/:doctorId/date/:date/working-hours', verifyToken, verifyRole('Manager'), updateDoctorWorkingHoursForDate);

module.exports = router;
