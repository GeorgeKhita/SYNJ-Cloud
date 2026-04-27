const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

router.get('/products/:id/options', productController.getOptions);

module.exports = router;