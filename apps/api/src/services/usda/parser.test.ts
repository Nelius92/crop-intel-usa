import { describe, expect, it } from 'vitest';
import { parseGrainBidResponse } from './parser.js';

describe('parseGrainBidResponse', () => {
    it('parses USDA report detail rows for the requested commodity', () => {
        const response = parseGrainBidResponse(
            [
                {
                    reportSection: 'Report Detail',
                    results: [
                        {
                            current: 'Yes',
                            commodity: 'Corn',
                            class: 'Yellow Corn',
                            grade: '2',
                            trade_loc: 'Fargo',
                            market_location_state: 'ND',
                            'basis Min': -60,
                            'basis Max': -50,
                            'basis Min Futures Month': 'May (K)',
                            'basis Min Direction': 'UP',
                            'basis Min Change': 5,
                            'price Min': 4.05,
                            'price Max': 4.15,
                            avg_price: 4.1,
                            avg_price_year_ago: 4.35,
                            delivery_point: 'Processor',
                            freight: 'FOB',
                            trans_mode: 'Truck',
                            report_date: '2026-04-10',
                        },
                        {
                            current: 'Yes',
                            commodity: 'Soybeans',
                            class: 'Soybeans',
                            grade: '1',
                            trade_loc: 'Fargo',
                            market_location_state: 'ND',
                            'basis Min': -20,
                            'basis Max': -10,
                            'basis Min Futures Month': 'May (K)',
                            'basis Min Direction': 'DOWN',
                            'basis Min Change': -2,
                            'price Min': 10.2,
                            'price Max': 10.4,
                            avg_price: 10.3,
                            avg_price_year_ago: 10.8,
                            delivery_point: 'Processor',
                            freight: 'FOB',
                            trans_mode: 'Truck',
                            report_date: '2026-04-10',
                        },
                    ],
                },
            ],
            'Yellow Corn',
            'ND'
        );

        expect(response.success).toBe(true);
        expect(response.degraded).toBe(false);
        expect(response.source).toBe('usda-ams');
        if (!('summary' in response.data)) {
            throw new Error('Expected live USDA response');
        }

        expect(response.data.summary).toMatchObject({
            commodity: 'Yellow Corn',
            state: 'ND',
            avgBasis: -55,
            avgBasisDollars: -0.55,
            trend: 'UP',
            avgPrice: 4.1,
            bidCount: 1,
            reportDate: '2026-04-10',
        });
        expect(response.data.bids).toHaveLength(1);
        expect(response.data.results).toEqual([
            {
                region: 'Fargo',
                state: 'ND',
                basis: -55,
                trend: 'UP',
            },
        ]);
    });

    it('falls back when no USDA rows match the commodity filter', () => {
        const response = parseGrainBidResponse(
            [
                {
                    reportSection: 'Report Detail',
                    results: [
                        {
                            current: 'Yes',
                            commodity: 'Soybeans',
                            class: 'Soybeans',
                        },
                    ],
                },
            ],
            'Yellow Corn',
            'ND'
        );

        expect(response.success).toBe(false);
        expect(response.degraded).toBe(true);
        expect(response.source).toBe('fallback');
        if (!('fallback' in response)) {
            throw new Error('Expected fallback USDA response');
        }
        expect(response.fallback).toBe(true);
        expect(response.data.results.length).toBeGreaterThan(0);
    });
});
