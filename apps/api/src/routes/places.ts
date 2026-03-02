import { Router } from 'express';
import { searchGooglePlaces, fetchGooglePlaceDetails } from '../services/google-places.js';

export const placesRouter = Router();

placesRouter.get('/search', async (req, res, next) => {
    try {
        const query = req.query.q as string;
        if (!query) {
            res.status(400).json({ error: 'Missing query parameter q' } as any);
            return;
        }
        const results = await searchGooglePlaces(query);
        res.json({ data: results });
    } catch (error) {
        next(error);
    }
});

placesRouter.get('/details', async (req, res, next) => {
    try {
        const placeId = req.query.placeId as string;
        if (!placeId) {
            res.status(400).json({ error: 'Missing query parameter placeId' } as any);
            return;
        }
        const details = await fetchGooglePlaceDetails(placeId);
        res.json({ data: details });
    } catch (error) {
        next(error);
    }
});
