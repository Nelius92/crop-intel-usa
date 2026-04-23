import { Router } from 'express';
import {
    handleFuturesPrice,
    handleGrainReport,
    handleRegionalBasis,
    handleSunflowerReport,
} from '../services/usda/handlers.js';

export const usdaRouter = Router();

usdaRouter.get('/grain-report', handleGrainReport);
usdaRouter.get('/sunflower-report', handleSunflowerReport);
usdaRouter.get('/regional-basis', handleRegionalBasis);
usdaRouter.get('/futures-price', handleFuturesPrice);
