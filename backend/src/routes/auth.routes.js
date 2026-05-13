const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/sync', authController.wordpressSync);
router.post('/refresh', authController.refresh);

module.exports = router;