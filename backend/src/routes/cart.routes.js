import { Router } from 'express';
import { requireApiKey } from '../middlewares/apiKey.middleware.js';
import * as cartController from '../controllers/cart.controller.js';

const router = Router();

router.use(requireApiKey);
router.post('/reserve',            cartController.reserve);
router.delete('/reserve/:cartId',  cartController.release);

export default router;
