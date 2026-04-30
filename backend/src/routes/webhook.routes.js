const express = require('express');
const router = express.Router();
const webhook_controller = require('../controllers/webhook.controller');

router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), webhook_controller.handleWebhook);

module.exports = router;