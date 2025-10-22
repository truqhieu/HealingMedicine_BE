const express = require('express');
const router = express.Router();
const { getDoctorAppointmentsSchedule, getAppointmentDetail, getPatientDetail } = require('../controllers/doctor.controller');
const { verifyToken, verifyRole } = require('../middleware/auth.middleware');

// ⭐ Doctor xem danh sách lịch hẹn trong tuần hiện tại + tuần tiếp theo (2 tuần)
router.get('/appointments-schedule', verifyToken, verifyRole('Doctor'), getDoctorAppointmentsSchedule);

// ⭐ Doctor xem chi tiết một lịch hẹn (Pop-up ca khám)
router.get('/appointments/:appointmentId', verifyToken, verifyRole('Doctor'), getAppointmentDetail);

// ⭐ Doctor xem chi tiết thông tin bệnh nhân (Pop-up thông tin bệnh nhân)
router.get('/patients/:patientId', verifyToken, verifyRole('Doctor'), getPatientDetail);

module.exports = router;
