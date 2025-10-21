const express = require('express');
const router = express.Router();
const { createService, getAllServices, viewDetailService, updateService, deleteService } = require('../controllers/service.controller')

router.post('/services', createService)
router.get('/services', getAllServices)
router.get('/services/:id', viewDetailService)
router.patch('/services:id', updateService)
router.delete('/services/:id', deleteService)

module.exports = router 