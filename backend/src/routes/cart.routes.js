const express = require('express');
const router = express.Router();
const cart_controller = require('../controllers/cart.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.post('/cart/validate', verifyToken, cart_controller.validateCart);
router.post('/cart/checkout', verifyToken, cart_controller.checkout);

module.exports = router;