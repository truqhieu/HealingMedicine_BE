const express = require('express');
const router = express.Router();

// Import routes
const userRoutes = require('./user.route');
const tempRegisterRoutes = require('./tempRegister.route');

// Authentication routes
router.use('/auth', userRoutes);

// Temporary registration routes
router.use('/temp-register', tempRegisterRoutes);


module.exports = router;
