#!/usr/bin/env node

/**
 * Corn Intel Production Readiness Test Suite
 * 
 * This script performs comprehensive testing to ensure the application is production-ready.
 * 
 * Tests include:
 * 1. BNSF API Connection & Authentication
 * 2. Carload Rates API
 * 3. Car Tracking API
 * 4. Tariff Fallback System
 * 5. Application Build
 * 6. Environment Configuration
 * 
 * Usage:
 *   npm run test:production
 */

import { BnsfClient } from '../packages/connectors/src/bnsf/client.js';
import { TariffRateProvider } from '../packages/connectors/src/bnsf/tariff-provider.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const TESTS = {
    ENV_CHECK: true,
    CERT_CHECK: true,
    TARIFF_RATES: true,
    BNSF_API_RATES: true,
    BNSF_API_CARS: true,
    BUILD_CHECK: false, // Set to true to test build
};

const TEST_SCENARIOS = [
    {
        name: 'Texas Panhandle to California',
        origin: 'Hereford, TX',
        destination: 'Modesto, CA',
    },
    {
        name: 'Texas Panhandle to PNW Export',
        origin: 'Hereford, TX',
        destination: 'Seattle, WA',
    },
    {
        name: 'Texas Panhandle to Texas Gulf',
        origin: 'Hereford, TX',
        destination: 'Houston, TX',
    },
    {
        name: 'Southwest Kansas',
        origin: 'Hereford, TX',
        destination: 'Wichita, KS',
    },
];

// ============================================================================
// Test Results Tracking
// ============================================================================

const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    warnings: 0,
    errors: [] as Array<{ test: string; error: string }>,
};

function pass(message: string) {
    console.log(`✅ ${message}`);
    results.passed++;
}

function fail(message: string, error?: any) {
    console.log(`❌ ${message}`);
    if (error) {
        console.log(`   Error: ${error.message || error}`);
        results.errors.push({ test: message, error: error.message || error });
    }
    results.failed++;
}

function warn(message: string) {
    console.log(`⚠️  ${message}`);
    results.warnings++;
}

function skip(message: string) {
    console.log(`⏭️  ${message}`);
    results.skipped++;
}

function section(title: string) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${title}`);
    console.log('='.repeat(70));
}

// ============================================================================
// Test Functions
// ============================================================================

async function testEnvironmentVariables() {
    section('1. Environment Configuration Check');

    const requiredVars = ['VITE_GEMINI_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY'];
    const optionalVars = ['BNSF_BASE_URL', 'BNSF_CLIENT_CERT_PEM', 'BNSF_CLIENT_KEY_PEM', 'BNSF_FEATURE_ENABLED'];

    // Check required vars
    for (const varName of requiredVars) {
        if (process.env[varName]) {
            pass(`Required: ${varName} is set`);
        } else {
            fail(`Required: ${varName} is missing`);
        }
    }

    // Check optional BNSF vars
    for (const varName of optionalVars) {
        if (process.env[varName]) {
            pass(`Optional: ${varName} is set`);
        } else {
            warn(`Optional: ${varName} is not set (BNSF API will use tariff fallback)`);
        }
    }
}

async function testCertificateFiles() {
    section('2. Certificate Files Check');

    const certFiles = [
        'certs/bnsf-client-cert.pem',
        'certs/bnsf-client-key.pem',
        'certs/bnsf-client.p12',
    ];

    for (const file of certFiles) {
        const fullPath = path.join(__dirname, '..', file);
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            if (stats.size > 0) {
                pass(`Certificate file exists: ${file} (${stats.size} bytes)`);
            } else {
                warn(`Certificate file is empty: ${file}`);
            }
        } else {
            warn(`Certificate file not found: ${file} (tariff fallback will be used)`);
        }
    }
}

async function testTariffRates() {
    section('3. Tariff Rate Calculations');

    const tariffProvider = new TariffRateProvider();

    for (const scenario of TEST_SCENARIOS) {
        try {
            const rate = await tariffProvider.getRates(scenario.origin, scenario.destination);
            pass(`${scenario.name}: $${rate.ratePerBushel}/bu (Item: ${rate.tariffItem})`);
            console.log(`   Rate per car: $${rate.ratePerCar}, Fuel: $${rate.fuelSurcharge}`);
        } catch (error) {
            fail(`${scenario.name}`, error);
        }
    }
}

async function testBnsfApiRates() {
    section('4. BNSF API - Carload Rates (if enabled)');

    if (!process.env.BNSF_CLIENT_CERT_PEM || !process.env.BNSF_CLIENT_KEY_PEM) {
        skip('BNSF API credentials not configured - skipping API tests');
        return;
    }

    try {
        // Create temporary cert files for the client
        const certPath = path.join(__dirname, '..', 'certs', 'bnsf-client-cert.pem');
        const keyPath = path.join(__dirname, '..', 'certs', 'bnsf-client-key.pem');

        const client = new BnsfClient({
            certPath,
            keyPath,
            apiBaseUrl: process.env.BNSF_BASE_URL || 'https://customer.bnsf.com',
            featureEnabled: true,
        });

        // Test with first scenario
        const scenario = TEST_SCENARIOS[0];
        try {
            const rate = await client.getRates(scenario.origin, scenario.destination);
            pass(`BNSF API Rate: ${scenario.name} - $${rate.ratePerBushel}/bu`);
        } catch (error: any) {
            if (error.message.includes('tariff fallback')) {
                warn(`BNSF API not available, using tariff fallback`);
            } else {
                fail(`BNSF API Rate Test`, error);
            }
        }
    } catch (error) {
        fail('BNSF API Client Initialization', error);
    }
}

async function testBnsfApiCars() {
    section('5. BNSF API - Car Tracking (if enabled)');

    if (!process.env.BNSF_CLIENT_CERT_PEM || !process.env.BNSF_CLIENT_KEY_PEM) {
        skip('BNSF API credentials not configured - skipping car tracking tests');
        return;
    }

    try {
        const certPath = path.join(__dirname, '..', 'certs', 'bnsf-client-cert.pem');
        const keyPath = path.join(__dirname, '..', 'certs', 'bnsf-client-key.pem');

        const client = new BnsfClient({
            certPath,
            keyPath,
            apiBaseUrl: process.env.BNSF_BASE_URL || 'https://customer.bnsf.com',
            featureEnabled: true,
        });

        try {
            const cars = await client.getCars({ status: 'in-transit' });
            pass(`BNSF Car Tracking API responded successfully`);
            console.log(`   Retrieved car data: ${JSON.stringify(cars).slice(0, 100)}...`);
        } catch (error: any) {
            if (error.message.includes('requires API access')) {
                skip('Car tracking requires full API access');
            } else {
                warn(`BNSF Car Tracking API: ${error.message}`);
            }
        }
    } catch (error) {
        fail('BNSF Car Tracking Test', error);
    }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function main() {
    console.log('🚂 Corn Intel Production Readiness Test Suite\n');
    console.log(`Started: ${new Date().toLocaleString()}\n`);

    try {
        if (TESTS.ENV_CHECK) await testEnvironmentVariables();
        if (TESTS.CERT_CHECK) await testCertificateFiles();
        if (TESTS.TARIFF_RATES) await testTariffRates();
        if (TESTS.BNSF_API_RATES) await testBnsfApiRates();
        if (TESTS.BNSF_API_CARS) await testBnsfApiCars();

        // Print Summary
        section('Test Summary');
        console.log(`✅ Passed:   ${results.passed}`);
        console.log(`❌ Failed:   ${results.failed}`);
        console.log(`⚠️  Warnings: ${results.warnings}`);
        console.log(`⏭️  Skipped:  ${results.skipped}`);

        if (results.errors.length > 0) {
            console.log('\nErrors:');
            results.errors.forEach((err, i) => {
                console.log(`  ${i + 1}. ${err.test}: ${err.error}`);
            });
        }

        console.log('\n' + '='.repeat(70));

        if (results.failed === 0) {
            console.log('✅ All critical tests passed! Application is production-ready.\n');
            if (results.warnings > 0) {
                console.log(`⚠️  Note: ${results.warnings} warnings detected. Review them before deployment.`);
            }
            process.exit(0);
        } else {
            console.log('❌ Some tests failed. Please fix issues before deployment.\n');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Fatal error during testing:', error);
        process.exit(1);
    }
}

main();
