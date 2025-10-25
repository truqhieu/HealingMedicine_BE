const express = require('express');
const router = express.Router();
const { getNurseSchedule, getAppointmentDetail, getPatientDetail } = require('../controllers/nurse.controller');
const { verifyToken, verifyRole } = require('../middleware/auth.middleware');

// ⭐ Nurse xem danh sách lịch hẹn của tất cả bác sĩ (tuần hiện tại + tuần tiếp theo)
router.get('/appointments-schedule', verifyToken, verifyRole('Nurse'), getNurseSchedule);

// ⭐ Nurse xem chi tiết một lịch hẹn (Pop-up ca khám)
router.get('/appointments/:appointmentId', verifyToken, verifyRole('Nurse'), getAppointmentDetail);

// ⭐ Nurse xem chi tiết thông tin bệnh nhân (Pop-up thông tin bệnh nhân)
router.get('/patients/:patientId', verifyToken, verifyRole('Nurse'), getPatientDetail);

module.exports = router;
