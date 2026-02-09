import { Router } from 'express';
import { logger } from '../logger.js';

export const buyersRouter = Router();

// Temporary mock response until we set up database
// This will be replaced with real database queries
const getMockBuyers = () => [
    {
        id: 'buyer-1',
        name: 'ADM Cedar Rapids',
        type: 'processor',
        city: 'Cedar Rapids',
        state: 'IA',
        lat: 42.0083,
        lng: -91.6436,
        cashPrice: 4.50,
        basis: 0.05,
        railAccessible: true,
    },
    {
        id: 'buyer-2',
        name: 'Heartland Co-Op',
        type: 'elevator',
        city: 'West Des Moines',
        state: 'IA',
        lat: 41.5868,
        lng: -93.7938,
        cashPrice: 4.45,
        basis: 0.00,
        railAccessible: true,
    },
];

buyersRouter.get('/', async (req, res, next) => {
    try {
        const { state } = req.query;

        logger.info('Fetching buyers', { state });

        // TODO: Replace with database query
        // const buyers = await buyersRepo.findAll();

        let buyers = getMockBuyers();

        // Filter by state if provided
        if (state) {
            buyers = buyers.filter(b => b.state === state);
        }

        res.json({
            data: buyers,
            count: buyers.length,
        });
    } catch (error) {
        next(error);
    }
});

buyersRouter.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        logger.info('Fetching buyer by ID', { id });

        // TODO: Replace with database query
        const buyers = getMockBuyers();
        const buyer = buyers.find(b => b.id === id);

        if (!buyer) {
            return res.status(404).json({ error: 'Buyer not found' });
        }

        res.json({ data: buyer });
    } catch (error) {
        next(error);
    }
});
