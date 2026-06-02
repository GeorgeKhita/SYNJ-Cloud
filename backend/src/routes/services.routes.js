import { Router } from 'express';
import { requireApiKey } from '../middlewares/apiKey.middleware.js';
import * as servicesController from '../controllers/services.controller.js';

const router = Router();

router.use(requireApiKey);
router.get('/', servicesController.list);

export default router;
