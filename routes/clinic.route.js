const express = require('express');
const router = express.Router()
const { createClinicRoom, getAllClinicRooms, viewDetailClinicRoom, updateClinicRoom, deleteClinicRoom, listDoctor, assignDoctor, unssignDoctor } = require('../controllers/clinic.controller');

router.post('/clinics', createClinicRoom)
router.get('/clinics', getAllClinicRooms)
router.get('/clinics/doctor', listDoctor)
router.get('/clinics/:id', viewDetailClinicRoom)
router.patch('/clinics/:id', updateClinicRoom)
router.delete('/clinics/:id', deleteClinicRoom)
router.patch('/clinics/assign-doctor/:id', assignDoctor)
router.patch('/clinics/unssign-doctor/:id', unssignDoctor)

module.exports = router;


