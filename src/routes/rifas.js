import express from 'express';
import { getAllRifas } from '../controllers/rifasController.js';

const router = express.Router();

router.get('/', getAllRifas);

export default router;
