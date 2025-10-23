const express = require('express');
const router = express.Router();
const { 
  createConsultationAppointment, 
  reviewAppointment,
  getPendingAppointments,
  getAllAppointments,
  getMyAppointments,
  updateAppointmentStatus
} = require('../controllers/appointment.controller');
const { verifyToken, verifyRole } = require('../middleware/auth.middleware');

// ⭐ Patient đặt lịch tư vấn/khám - Cần đăng nhập
router.post('/consultation/create', verifyToken, verifyRole('Patient'), createConsultationAppointment);

// Bao gồm cả lịch tư vấn và lịch khám
router.post('/create-by-staff', verifyToken, verifyRole(['Staff', 'Manager']), createConsultationAppointment);

// ⭐ Staff duyệt hoặc hủy lịch hẹn - Chỉ Staff/Manager được phép
router.post('/review', verifyToken, verifyRole(['Staff']), reviewAppointment);

// ⭐ API lấy danh sách lịch hẹn chờ duyệt - Staff/Manager xem
router.get('/pending', verifyToken, verifyRole(['Staff', 'Manager']), getPendingAppointments);

//  API lấy danh sách tất cả lịch hẹn (có filter)
// Patient xem lịch của mình, Staff/Manager/Doctor xem tất cả
router.get('/all', verifyToken, getAllAppointments);

// ⭐ Lấy danh sách ca khám của người dùng hiện tại - Cần đăng nhập
router.get('/my-appointments', verifyToken, getMyAppointments);

// ⭐ Cập nhật trạng thái ca khám (Staff check-in, Nurse hoàn thành)
// Staff: Approved → CheckedIn
router.put('/:appointmentId/status', verifyToken, verifyRole(['Staff', 'Nurse', 'Manager']), updateAppointmentStatus);

module.exports = router;
