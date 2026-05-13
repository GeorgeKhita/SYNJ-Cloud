const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/orders/pre-check', verifyToken, orderController.preCheck);
router.post('/orders/provision', verifyToken, orderController.provision);

module.exports = router;