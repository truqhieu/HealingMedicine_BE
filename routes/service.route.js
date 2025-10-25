const express = require('express');
const router = express.Router();
const { createService, getAllServices, viewDetailService, updateService, deleteService } = require('../controllers/service.controller')
const { verifyToken, verifyRole } = require('../middleware/auth.middleware');

// ⭐ Manager quản lý dịch vụ (CRUD)
router.post('/services', verifyToken, verifyRole('Manager'), createService)
router.get('/services', getAllServices) 
router.get('/services/:id', viewDetailService) 
router.patch('/services/:id', verifyToken, verifyRole('Manager'), updateService)
router.delete('/services/:id', verifyToken, verifyRole('Manager'), deleteService)

module.exports = router 