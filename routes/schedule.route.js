const express = require('express');
const router = express.Router();
const { checkAvailableDoctors, createScheduleDoctor, getAllScheduleDoctor, deleteSchedule } = require('../controllers/shedule.controller');

router.get('/schedules/doctor-available', checkAvailableDoctors)
router.post('/schedules', createScheduleDoctor)
router.get('/schedules', getAllScheduleDoctor)
router.delete('/schedules/:id', deleteSchedule)

module.exports = router;
