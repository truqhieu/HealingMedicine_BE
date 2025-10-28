const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policy.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Public routes - không cần authentication
router.get('/', policyController.getActivePolicies);

// Protected routes - cần authentication (chỉ admin/manager)
router.get('/all', authMiddleware.authenticate, policyController.getAllPolicies);
router.post('/', authMiddleware.authenticate, policyController.createPolicy);
router.put('/:id', authMiddleware.authenticate, policyController.updatePolicy);
router.delete('/:id', authMiddleware.authenticate, policyController.deletePolicy);

module.exports = router;
