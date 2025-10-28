const express = require('express');
const { verifyToken, verifyRole } = require('../middleware/auth.middleware');
const { createComplaint, getAllComplaints, viewDetailComplaint, handleComplaint, deleteComplaint } = require('../controllers/complaint.cotroller');
const router = express.Router();

router.post('/', verifyToken, verifyRole('Patient'), createComplaint)
router.get('/', verifyToken, verifyRole('Staff'), getAllComplaints)
router.get('/:id', verifyToken, verifyRole('Staff'), viewDetailComplaint)
router.patch('/:id', verifyToken, verifyRole('Staff'), handleComplaint)
router.delete('/:id', verifyToken, verifyRole('Patient'),deleteComplaint)

module.exports = router;

