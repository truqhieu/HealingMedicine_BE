const express = require('express');
const router = express.Router();
const { createService, getAllServices, viewDetailService, updateService, deleteService, getDiscountedServiceDetail, getDiscountedServices } = require('../controllers/service.controller')
const { verifyToken, verifyRole } = require('../middleware/auth.middleware');

// ⭐ Manager quản lý dịch vụ (CRUD)
router.post('/services', verifyToken, verifyRole('Manager'), createService)
router.get('/services', getAllServices) 
router.get('/services/discounted', getDiscountedServices) 
router.get('/services/:id', viewDetailService) 
router.get('/services/discounted/:id', getDiscountedServiceDetail) 
router.patch('/services/:id', verifyToken, verifyRole('Manager'), updateService)
router.delete('/services/:id', verifyToken, verifyRole('Manager'), deleteService)

module.exports = router 