import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface FacilitySeedRecord {
    name: string;
    type: string;
    city: string;
    state: string;
    lat: number;
    lng: number;
    region: string;
    phone?: string;
    website?: string;
    organic?: boolean;
    cropType?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveFacilitySeedPath(): string {
    const candidates = [
        path.resolve(__dirname, '../../seeds/facilities.seed.json'),
        path.resolve(process.cwd(), 'apps/api/seeds/facilities.seed.json'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }

    throw new Error(`Could not find facilities seed file. Checked: ${candidates.join(', ')}`);
}

export function loadFacilitySeed(): { path: string; facilities: FacilitySeedRecord[] } {
    const seedPath = resolveFacilitySeedPath();
    const raw = fs.readFileSync(seedPath, 'utf-8');
    const facilities = JSON.parse(raw) as FacilitySeedRecord[];
    return { path: seedPath, facilities };
}
