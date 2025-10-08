const express = require('express');
const router = express.Router();
const {getAllManager,getManagerById,updateManager,createManager} = require('../controllers/admin.controller');

router.get('/', getAllManager);
router.get('/:id', getManagerById);
router.post('/', createManager);
router.patch('/:id', updateManager);

module.exports = router;