const express = require('express');
const router = express.Router();
const {createAccount, getAllAccounts, viewDetailAccount, updateAccount,lockAcount, unlockAcount, changePassword, assignRole} = require('../controllers/admin.controller');

router.post('/accounts', createAccount)
router.get('/accounts', getAllAccounts)
router.get('/accounts/:id', viewDetailAccount)
router.patch('/accounts/:id', updateAccount)
router.patch('/accounts/lock/:id', lockAcount)
router.patch('/accounts/unlock/:id', unlockAcount)
router.patch('/accounts/change-password/:id', changePassword)
router.patch('/accounts/assign-role/:id', assignRole)

module.exports = router;