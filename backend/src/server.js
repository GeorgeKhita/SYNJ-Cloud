import 'dotenv/config';
import './config/env.js';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

import logger, { httpLogger } from './utils/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { env } from './config/env.js';

import availabilityRoutes from './routes/availability.routes.js';
import cartRoutes         from './routes/cart.routes.js';
import provisionRoutes    from './routes/provision.routes.js';
import servicesRoutes     from './routes/services.routes.js';
import { startCleanupCron } from './cron/cleanup.cron.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, limit: 100 }));
app.use(httpLogger);

app.use('/availability', availabilityRoutes);
app.use('/cart',         cartRoutes);
app.use('/provision',    provisionRoutes);
app.use('/services',     servicesRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  startCleanupCron();
});
