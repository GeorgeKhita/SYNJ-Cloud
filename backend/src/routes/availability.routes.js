import { Router } from 'express';
import { requireApiKey } from '../middlewares/apiKey.middleware.js';
import * as availabilityController from '../controllers/availability.controller.js';

const router = Router();

router.use(requireApiKey);
router.get('/memory',  availabilityController.memory);
router.get('/cpu',     availabilityController.cpu);
router.get('/storage', availabilityController.storage);
router.post('/check',  availabilityController.check);

export default router;
