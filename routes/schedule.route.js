const express = require('express');
const router = express.Router();
const { checkAvailableDoctors, createScheduleDoctor, getAllScheduleDoctors, deleteSchedule, updateScheduleDoctor, viewDetailScheduleDoctor } = require('../controllers/shedule.controller');
const { updateWorkingHours, getWorkingHours, updateDoctorWorkingHoursForDate, getDoctorsWithWorkingHours, updateDoctorWorkingHours } = require('../controllers/schedule.controller');
const { verifyToken, verifyRole } = require('../middleware/auth.middleware');

router.get('/schedules/doctor-available', verifyToken, verifyRole('Manager'), checkAvailableDoctors)
router.post('/schedules', verifyToken, verifyRole('Manager'),createScheduleDoctor)
router.get('/schedules', verifyToken, verifyRole('Manager'),getAllScheduleDoctors)

// New routes for doctor working hours management - MUST be before /schedules/:id
router.get('/schedules/doctors-with-working-hours', verifyToken, verifyRole('Manager'), getDoctorsWithWorkingHours)
router.put('/schedules/doctor/:doctorId/working-hours', verifyToken, verifyRole('Manager'), updateDoctorWorkingHours)

// Working Hours routes
router.get('/schedules/:scheduleId/working-hours', verifyToken, verifyRole('Manager'), getWorkingHours)
router.put('/schedules/:scheduleId/working-hours', verifyToken, verifyRole('Manager'), updateWorkingHours)
router.put('/schedules/doctor/:doctorId/date/:date/working-hours', verifyToken, verifyRole('Manager'), updateDoctorWorkingHoursForDate)

// These routes with :id parameter MUST be last
router.get('/schedules/:id', verifyToken, verifyRole('Manager'),viewDetailScheduleDoctor)
router.patch('/schedules/:id', verifyToken, verifyRole('Manager'),updateScheduleDoctor)
router.delete('/schedules/:id',verifyToken, verifyRole('Manager'), deleteSchedule)

module.exports = router;
