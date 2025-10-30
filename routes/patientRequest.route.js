const express = require('express');
const router = express.Router();
const {
  getAllPatientRequests,
  getPatientRequestById,
  approveRequest,
  rejectRequest
} = require('../controllers/patientRequest.controller');
const { verifyToken, verifyRole } = require('../middleware/auth.middleware');

// ⭐ Routes cho Staff (quản lý yêu cầu)
router.get('/', verifyToken, verifyRole(['Staff', 'Manager']), getAllPatientRequests);
router.get('/:requestId', verifyToken, verifyRole(['Staff', 'Manager']), getPatientRequestById);
router.put('/:requestId/approve', verifyToken, verifyRole(['Staff', 'Manager']), approveRequest);
router.put('/:requestId/reject', verifyToken, verifyRole(['Staff', 'Manager']), rejectRequest);

module.exports = router;
