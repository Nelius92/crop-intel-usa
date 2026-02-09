import https from 'https';
import fs from 'fs';
import { RailRate, RateProvider } from './types.js';
import { TariffRateProvider } from './tariff-provider.js';

export interface BnsfClientConfig {
    certPath?: string;
    keyPath?: string;
    apiBaseUrl?: string;
    featureEnabled?: boolean;
}

/**
 * BNSF API client with mTLS support
 * Falls back to tariff-based rates when API is unavailable or disabled
 */
export class BnsfClient implements RateProvider {
    private cert: Buffer | null = null;
    private key: Buffer | null = null;
    private tariffFallback: TariffRateProvider;
    private config: BnsfClientConfig;

    constructor(config: BnsfClientConfig = {}) {
        this.config = {
            // BNSF API requires port 6443 for mTLS API access
            apiBaseUrl: 'https://api.bnsf.com:6443',
            featureEnabled: false,
            ...config,
        };

        this.tariffFallback = new TariffRateProvider();

        // Load certificates if paths are provided
        if (config.certPath && config.keyPath) {
            try {
                this.cert = fs.readFileSync(config.certPath);
                this.key = fs.readFileSync(config.keyPath);
            } catch (error) {
                console.warn('Failed to load BNSF certificates, using tariff fallback:', error);
            }
        }
    }

    private async httpsRequest(url: URL, options: https.RequestOptions, body?: string): Promise<{ status: number; data: any }> {
        return new Promise((resolve, reject) => {
            const req = https.request(url, {
                ...options,
                cert: this.cert || undefined,
                key: this.key || undefined,
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({
                            status: res.statusCode || 0,
                            data: JSON.parse(data),
                        });
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
                    }
                });
            });

            req.on('error', reject);
            req.setTimeout(15000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (body) {
                req.write(body);
            }
            req.end();
        });
    }

    async getRates(origin: string, destination: string): Promise<RailRate> {
        // Use tariff fallback if API is disabled or no certificates
        if (!this.config.featureEnabled || !this.cert || !this.key) {
            return this.tariffFallback.getRates(origin, destination);
        }

        try {
            const url = new URL('/v1/carload-rates', this.config.apiBaseUrl);
            const requestBody = JSON.stringify({
                priceAuthorityOwnerIssuedName: 'BNSF',
                priceAuthorityNumber: 4022,  // BNSF Ag/Grain tariff
                priceAuthorityItemNumber: 31750,  // Corn item number
            });

            const { status, data } = await this.httpsRequest(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                },
            }, requestBody);

            if (status !== 200) {
                throw new Error(`BNSF API returned ${status}`);
            }

            // Parse BNSF response and find best matching rate
            const prices = data?.message?.results?.priceAuthority?.prices || [];
            if (prices.length === 0) {
                throw new Error('No rates found in BNSF response');
            }

            // Find rate matching destination (simplified matching)
            const destLower = destination.toLowerCase();
            const matchedPrice = prices.find((p: any) => {
                const pDest = (p.destinationStationName || p.destinationGeographicGroupName || '').toLowerCase();
                return pDest.includes(destLower) || destLower.includes(pDest);
            }) || prices[0]; // Fallback to first rate

            const ratePerCar = matchedPrice.priceAuthorityPriceAmount || 0;
            const BUSHELS_PER_CAR = 4000;
            const FUEL_SURCHARGE = 250;
            const totalCost = ratePerCar + FUEL_SURCHARGE;

            return {
                ratePerBushel: parseFloat((totalCost / BUSHELS_PER_CAR).toFixed(2)),
                ratePerCar: totalCost,
                tariffItem: `PA-${data?.message?.results?.priceAuthority?.priceAuthorityNumber || '4022'} (BNSF API)`,
                source: 'bnsf-api',
            };
        } catch (error) {
            console.warn('BNSF API call failed, using tariff fallback:', error);
            return this.tariffFallback.getRates(origin, destination);
        }
    }

    /**
     * Get car tracking data from BNSF /v1/cars endpoint
     */
    async getCars(filters?: { status?: string; destination?: string }) {
        if (!this.config.featureEnabled || !this.cert || !this.key) {
            throw new Error('BNSF car tracking requires API access');
        }

        const url = new URL('/v1/cars', this.config.apiBaseUrl);
        if (filters?.status) url.searchParams.set('status', filters.status);
        if (filters?.destination) url.searchParams.set('destination', filters.destination);

        const { status, data } = await this.httpsRequest(url, {
            method: 'GET',
        });

        if (status !== 200) {
            throw new Error(`BNSF API returned ${status}`);
        }

        return data;
    }
}
