const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middleware/auth.middleware');
const {createAccount, getAllAccounts, viewDetailAccount, updateAccount,lockAcount, unlockAcount, changePassword, assignRole} = require('../controllers/admin.controller');

// ⭐ Chỉ Admin được phép quản lý tài khoản
router.post('/accounts', createAccount)
router.get('/accounts',  getAllAccounts)
router.get('/accounts/:id', viewDetailAccount)
router.patch('/accounts/:id', verifyToken, verifyRole('Admin'), updateAccount)
router.patch('/accounts/lock/:id', verifyToken, verifyRole('Admin'), lockAcount)
router.patch('/accounts/unlock/:id', verifyToken, verifyRole('Admin'), unlockAcount)
router.patch('/accounts/change-password/:id', verifyToken, verifyRole('Admin'), changePassword)
router.patch('/accounts/assign-role/:id', verifyToken, verifyRole('Admin'), assignRole)

module.exports = router;
