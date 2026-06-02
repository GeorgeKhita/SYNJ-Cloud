import { Router } from 'express';
import { requireApiKey } from '../middlewares/apiKey.middleware.js';
import * as provisionController from '../controllers/provision.controller.js';

const router = Router();

router.use(requireApiKey);
router.post('/',                    provisionController.start);
router.get('/:serviceId/status',    provisionController.status);

export default router;
