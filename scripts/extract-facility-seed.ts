#!/usr/bin/env npx tsx
import fs from 'fs';
import path from 'path';

type FacilitySeedRecord = {
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
};

const repoRoot = process.cwd();
const sourcePath = path.resolve(repoRoot, 'scripts/generate-buyer-directory.ts');
const outputPath = path.resolve(repoRoot, 'apps/api/seeds/facilities.seed.json');

const source = fs.readFileSync(sourcePath, 'utf-8');
const startToken = 'const FACILITIES: FacilityTemplate[] = [';
const endToken = '];\n\n// ── Area codes by state for phone generation ──';
const startIndex = source.indexOf(startToken);
const endIndex = source.indexOf(endToken);

if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('Could not locate FACILITIES array in scripts/generate-buyer-directory.ts');
}

const arrayBody = source.slice(startIndex + startToken.length, endIndex);

// Trusted local source file: evaluate the array literal body into JS objects.
const facilities = Function(`"use strict"; return ([${arrayBody}]);`)() as FacilitySeedRecord[];

const normalized = facilities.map((f) => ({
    name: f.name,
    type: f.type,
    city: f.city,
    state: f.state,
    lat: f.lat,
    lng: f.lng,
    region: f.region,
    ...(f.phone ? { phone: f.phone } : {}),
    ...(f.website ? { website: f.website } : {}),
    ...(f.organic ? { organic: f.organic } : {}),
    ...(f.cropType ? { cropType: f.cropType } : {}),
}));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2) + '\n');

const withPhone = normalized.filter((f) => f.phone).length;
const withWebsite = normalized.filter((f) => f.website).length;

console.log(`Extracted ${normalized.length} facilities`);
console.log(`With seed phone: ${withPhone}`);
console.log(`With seed website: ${withWebsite}`);
console.log(`Wrote: ${outputPath}`);
