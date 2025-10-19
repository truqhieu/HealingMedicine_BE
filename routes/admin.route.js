const express = require('express');
const router = express.Router();
const {createAccount, getAllAccounts, viewDetailAccount, updateAccount,lockAcount, unlockAcount} = require('../controllers/admin.controller');

router.post('/accounts', createAccount)
router.get('/accounts', getAllAccounts)
router.get('/accounts/:id', viewDetailAccount)
router.patch('/accounts/:id', updateAccount)
router.patch('/accounts/lock/:id', lockAcount)
router.patch('/accounts/unlock/:id', unlockAcount)

module.exports = router;