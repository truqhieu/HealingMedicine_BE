const express = require('express');
const router = express.Router();

const userRoutes = require('./user.route');
const tempRegisterRoutes = require('./tempRegister.route');

router.use('/auth', userRoutes);

router.use('/temp-register', tempRegisterRoutes);


module.exports = router;
