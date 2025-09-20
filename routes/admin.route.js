const express = require('express');
const router = express.Router();
const {getAllUsers,getUserById,updateUser,bulkUpdateUser,createAccount} = require('../controllers/admin.controller');

router.get('/all', getAllUsers);
router.get('/:id', getUserById);
router.post('/create', createAccount);
router.patch('/:id', updateUser);
router.post('/bulk-update', bulkUpdateUser);

module.exports = router;