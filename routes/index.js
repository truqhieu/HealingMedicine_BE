const express = require('express');
const router = express.Router();

const userRoutes = require('./user.route');
const tempRegisterRoutes = require('./tempRegister.route');
const appointmentRoutes = require('./appointment.route');
const availableSlotRoutes = require('./availableSlot.route');
const paymentRoutes = require('./payment.route');

router.use('/auth', userRoutes);

router.use('/temp-register', tempRegisterRoutes);

router.use('/appointments', appointmentRoutes);

router.use('/available-slots', availableSlotRoutes);

router.use('/payments', paymentRoutes);

module.exports = router;
