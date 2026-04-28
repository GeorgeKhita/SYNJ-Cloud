const express = require('express');
const router = express.Router();
const cart_controller = require('../controllers/cart.controller');

router.post('/cart/validate', cart_controller.validateCart);

module.exports = router;