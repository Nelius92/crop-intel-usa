export interface RailRate {
    origin?: string;
    destination?: string;
    destination_city?: string;
    destination_state?: string;
    ratePerCar: number;
    ratePerBushel: number;
    fuelSurcharge?: number;
    tariffItem: string;
    distanceMiles?: number;
    estimatedDays?: number;
    source?: 'bnsf-api' | 'tariff-fallback';
}

export interface RateProvider {
    getRates(origin: string, destination: string): Promise<RailRate>;
}

export interface BnsfClientConfig {
    certPath?: string;
    keyPath?: string;
    apiBaseUrl?: string;
    featureEnabled?: boolean;
}
