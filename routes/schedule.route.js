const express = require('express');
const router = express.Router();
const { checkAvailableDoctors, createScheduleDoctor, getAllScheduleDoctors, deleteSchedule, updateScheduleDoctor, viewDetailScheduleDoctor } = require('../controllers/shedule.controller');
const { viewDetailClinicRoom } = require('../controllers/clinic.controller');
const { verifyToken, verifyRole } = require('../middleware/auth.middleware');

router.get('/schedules/doctor-available',verifyToken, verifyRole('Manager'), checkAvailableDoctors)
router.post('/schedules', verifyToken, verifyRole('Manager'),createScheduleDoctor)
router.get('/schedules', verifyToken, verifyRole('Manager'),getAllScheduleDoctors)
router.get('/schedules/:id', verifyToken, verifyRole('Manager'),viewDetailScheduleDoctor)
router.patch('/schedules/:id', verifyToken, verifyRole('Manager'),updateScheduleDoctor)
router.delete('/schedules/:id',verifyToken, verifyRole('Manager'), deleteSchedule)

module.exports = router;
