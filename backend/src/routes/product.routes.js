const express = require('express');
const router = express.Router();
const product_controller = require('../controllers/product.controller');

router.get('/products/:id/options', product_controller.getOptions);

module.exports = router;