const express = require('express');
const router = express.Router();

const userRoutes = require('./user.route');
const adminRoutes = require('./admin.route');
const serviceRoutes = require('./service.route')
const clinicRoutes = require('./clinic.route')
const tempRegisterRoutes = require('./tempRegister.route');
const appointmentRoutes = require('./appointment.route');
const availableSlotRoutes = require('./availableSlot.route');
const paymentRoutes = require('./payment.route');
const { deleteClinicRoom } = require('../controllers/clinic.controller');

router.use('/auth', userRoutes);
router.use('/admin', adminRoutes);
router.use('/manager', serviceRoutes);
router.use('/manager', clinicRoutes)

router.use('/temp-register', tempRegisterRoutes);

router.use('/appointments', appointmentRoutes);

router.use('/available-slots', availableSlotRoutes);

router.use('/payments', paymentRoutes);
// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'HealingMedicine API',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        verifyEmail: 'GET /api/auth/verify-email',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile (requires token)',
        updateProfile: 'PATCH /api/auth/profile (requires token)'
      },
      tempRegister: {
        resendVerification: 'POST /api/temp-register/resend-verification',
        checkStatus: 'GET /api/temp-register/status',
        cancel: 'DELETE /api/temp-register/cancel'
      },
      admin :{
        createAccount : 'POST /api/admin/accounts',
        getAllAccounts : 'GET /api/admin/accounts',
        viewDetailAccount : 'GET /api/admin/accounts/:id',
        updateAccount : 'PATCH /api/admin/accounts/:id',
        lockAccount : 'PATCH /api/admin/accounts/lock/:id',
        unlockAccount : 'PATCH /api/admin/accounts/unlock/:id',
        changePassword : 'PATCH /api/admin/accounts/change-password/:id',
        assignRole : 'PATCH /api/admin/accounts/assign-role/:id'
      },
      service : {
        createService : 'POST /api/manager/services',
        getAllServices : 'GET /api/manager/services',
        viewDetailService : 'GET /api/manager/services/:id',
        updateService : 'PATCH /api/manager/services/:id',
        deleteService : 'DELETE /api/manager/services/:id',
      },
      clinic : {
        createClinicRoom : 'POST /api/manager/clinics',
        getAllServices : 'GET /api/manager/clinics',
        viewDetailClinicRoom : 'GET /api/manager/clinics/:id',
        updateClinicRoom : 'PATCH /api/manager/clinics/:id',
        deleteClinicRoom : 'DELETE /api/manager/clinics/:id',
        listDoctor : 'GET /api/manager/clinics/doctor',
        assignDoctor : 'PACTH /api/manager/assign-doctor/:id',
        unssignDoctor : 'PACTH /api/manager/unssign-doctor/:id',
      }
    }
  });
});

module.exports = router;
