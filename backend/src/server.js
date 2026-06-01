import 'dotenv/config';
import './config/env.js';  // valide le .env au démarrage, crash si invalide

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

import logger, { httpLogger } from './utils/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { env } from './config/env.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.NODE_ENV === 'production' ? env.FRONTEND_URL : true,
}));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, limit: 100 }));
app.use(httpLogger);

import authRoutes    from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';

app.use('/auth',     authRoutes);
app.use('/products', productRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
});
