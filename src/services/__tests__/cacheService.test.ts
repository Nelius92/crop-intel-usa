import { describe, it, expect, beforeEach } from 'vitest';
import { cacheService, CACHE_TTL } from '../cacheService';

// Clear cache between tests to avoid state bleed
beforeEach(() => {
    cacheService.invalidate('test');
    cacheService.invalidate('freight');
    cacheService.invalidate('market');
    cacheService.invalidate('buyers');
});

describe('cacheService', () => {
    describe('set / get', () => {
        it('returns a stored value before TTL expires', () => {
            cacheService.set('test', 'hello', { data: 42 }, 60_000);
            const result = cacheService.get<{ data: number }>('test', 'hello');
            expect(result).not.toBeNull();
            expect(result!.data).toBe(42);
        });

        it('returns null for an unknown key', () => {
            const result = cacheService.get('test', 'nonexistent');
            expect(result).toBeNull();
        });

        it('returns null after TTL expires', async () => {
            cacheService.set('test', 'short', 'value', 1); // 1ms TTL
            await new Promise(r => setTimeout(r, 10));
            const result = cacheService.get('test', 'short');
            expect(result).toBeNull();
        });

        it('overwrites existing key on re-set', () => {
            cacheService.set('test', 'key', 'first', 60_000);
            cacheService.set('test', 'key', 'second', 60_000);
            expect(cacheService.get<string>('test', 'key')).toBe('second');
        });

        it('isolates different namespaces', () => {
            cacheService.set('test', 'same-key', 'namespace-test', 60_000);
            cacheService.set('market', 'same-key', 'namespace-market', 60_000);
            expect(cacheService.get<string>('test', 'same-key')).toBe('namespace-test');
            expect(cacheService.get<string>('market', 'same-key')).toBe('namespace-market');
        });
    });

    describe('isFresh', () => {
        it('returns true for a fresh entry', () => {
            cacheService.set('test', 'fresh-key', 'data', 60_000);
            expect(cacheService.isFresh('test', 'fresh-key')).toBe(true);
        });

        it('returns false for a missing entry', () => {
            expect(cacheService.isFresh('test', 'missing')).toBe(false);
        });

        it('returns false after TTL expires', async () => {
            cacheService.set('test', 'expiring', 'val', 1); // 1ms TTL
            await new Promise(r => setTimeout(r, 10));
            expect(cacheService.isFresh('test', 'expiring')).toBe(false);
        });
    });

    describe('invalidate', () => {
        it('removes a single key', () => {
            cacheService.set('test', 'a', 1, 60_000);
            cacheService.set('test', 'b', 2, 60_000);
            cacheService.invalidate('test', 'a');
            expect(cacheService.get('test', 'a')).toBeNull();
            expect(cacheService.get<number>('test', 'b')).toBe(2);
        });

        it('clears entire namespace when no key given', () => {
            cacheService.set('test', 'x', 1, 60_000);
            cacheService.set('test', 'y', 2, 60_000);
            cacheService.invalidate('test');
            expect(cacheService.get('test', 'x')).toBeNull();
            expect(cacheService.get('test', 'y')).toBeNull();
        });

        it('does not affect other namespaces', () => {
            cacheService.set('freight', 'rate-1', { ratePerBushel: 1.40 }, CACHE_TTL.FREIGHT_MS);
            cacheService.set('market', 'Yellow Corn', { price: 4.30 }, CACHE_TTL.MARKET_MS);
            cacheService.invalidate('freight');
            expect(cacheService.get('freight', 'rate-1')).toBeNull();
            expect(cacheService.get<any>('market', 'Yellow Corn')).not.toBeNull();
        });
    });

    describe('getAge', () => {
        it('returns a positive number for a fresh entry', () => {
            cacheService.set('test', 'aged', 'data', 60_000);
            const age = cacheService.getAge('test', 'aged');
            expect(age).not.toBeNull();
            expect(age!).toBeGreaterThanOrEqual(0);
            expect(age!).toBeLessThan(1_000); // Must be less than 1 second
        });

        it('returns null for a missing entry', () => {
            expect(cacheService.getAge('test', 'ghost')).toBeNull();
        });

        it('returns null after TTL expires', async () => {
            cacheService.set('test', 'expiring-age', 'val', 1); // 1ms TTL
            await new Promise(r => setTimeout(r, 10));
            expect(cacheService.getAge('test', 'expiring-age')).toBeNull();
        });
    });

    describe('getStats', () => {
        it('tracks hits and misses', () => {
            // Misses first
            cacheService.get('test', 'miss-1');
            cacheService.get('test', 'miss-2');
            // Hit
            cacheService.set('test', 'hit-key', 'val', 60_000);
            cacheService.get('test', 'hit-key');

            const stats = cacheService.getStats();
            expect(stats['test']).toBeDefined();
            expect(stats['test'].hits).toBeGreaterThanOrEqual(1);
            expect(stats['test'].misses).toBeGreaterThanOrEqual(2);
        });
    });

    describe('CACHE_TTL constants', () => {
        it('freight TTL is 12 hours', () => {
            expect(CACHE_TTL.FREIGHT_MS).toBe(12 * 60 * 60 * 1000);
        });
        it('market TTL is 30 minutes', () => {
            expect(CACHE_TTL.MARKET_MS).toBe(30 * 60 * 1000);
        });
        it('USDA TTL is 60 minutes', () => {
            expect(CACHE_TTL.USDA_MS).toBe(60 * 60 * 1000);
        });
        it('buyers TTL is 30 minutes', () => {
            expect(CACHE_TTL.BUYERS_MS).toBe(30 * 60 * 1000);
        });
    });
});
