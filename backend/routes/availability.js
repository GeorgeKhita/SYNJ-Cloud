const express = require('express');
const router = express.Router();
const availCtrl = require('../controllers/availability');

router.get('/memory', availCtrl.getMemory);
router.get('/cpu', availCtrl.getCPU);
router.get('/storage', availCtrl.getStorage);

module.exports = router;