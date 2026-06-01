import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import * as productController from '../controllers/product.controller.js';

const router = Router();

const calculateSchema = z.object({
  resources: z.record(z.number()),
});

router.get('/',                                                productController.list);
router.get('/:id',                                             productController.get);
router.post('/:id/calculate-price', validate(calculateSchema), productController.calculatePrice);

export default router;
