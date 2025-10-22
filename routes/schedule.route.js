const express = require('express');
const router = express.Router();
const { checkAvailableDoctors, createScheduleDoctor, getAllScheduleDoctors, deleteSchedule, getAllScheduleDoctors, updateScheduleDoctor } = require('../controllers/shedule.controller');
const { viewDetailClinicRoom } = require('../controllers/clinic.controller');

router.get('/schedules/doctor-available',verifyToken, verifyRole('Manager'), checkAvailableDoctors)
router.post('/schedules', verifyToken, verifyRole('Manager'),createScheduleDoctor)
router.get('/schedules', verifyToken, verifyRole('Manager'),getAllScheduleDoctors)
router.get('/schedules/:id', verifyToken, verifyRole('Manager'),viewDetailClinicRoom)
router.patch('/schedules/:id', verifyToken, verifyRole('Manager'),updateScheduleDoctor)
router.delete('/schedules/:id',verifyToken, verifyRole('Manager'), deleteSchedule)

module.exports = router;
