require('dotenv').config();
const express = require('express');
const cors = require('cors');
const product_router = require('./routes/product.routes');
const cart_router = require('./routes/cart.routes');
const webhook_router = require('./routes/webhook.routes');
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
require('./cron/cleanup.cron');
require('./config/redis.client');
require('./config/db.client');

const app = express();
app.use(cors());
app.use(webhook_router);
app.use(express.json());
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: "OK" });
});

app.use('/api', product_router);
app.use('/api', cart_router);
app.use('/api', orderRoutes);

app.listen(PORT, function (err) {
  if (err) console.log("Erreur lors de l'initialisation du serveur ...");
  else console.log("Server listening on Port", PORT);
});