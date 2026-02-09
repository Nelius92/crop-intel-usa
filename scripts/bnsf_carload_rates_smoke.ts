#!/usr/bin/env node

/**
 * BNSF Carload Rates Smoke Test
 * 
 * This standalone script tests the BNSF Carload Rates API with mTLS authentication.
 * 
 * Usage:
 *   ts-node scripts/bnsf_carload_rates_smoke.ts --owner BNSF --number 4022 [--item 31750]
 * 
 * Environment Variables:
 *   BNSF_BASE_URL          - Base URL for BNSF API (required)
 *   BNSF_CLIENT_CERT_PEM   - Client certificate in PEM format (required)
 *   BNSF_CLIENT_KEY_PEM    - Client private key in PEM format (required)
 *   BNSF_CA_PEM            - CA certificate in PEM format (optional)
 */

import https from 'https';
import { parseArgs } from 'util';

// ============================================================================
// Types
// ============================================================================

interface CarloadRatesRequestBody {
    priceAuthorityOwnerIssuedName: string;
    priceAuthorityNumber: number;
    priceAuthorityItemNumber?: number | string;  // Use number, or "" if not needed (NOT null)
}

// Response structure based on actual BNSF API response
interface BnsfPrice {
    priceAuthorityPriceEffectiveDate: string;
    priceAuthorityPriceExpirationDate: string;
    priceAuthorityPriceAmount: number;
    unitOfMeasure: string;
    priceAuthorityPriceUnitCalculationCode: string;
    minimumWeightQuantity: number;
    minimumWeightQuantityUomCode: string;
    originStateCode?: string;
    originStationName?: string;
    destinationStateCode?: string;
    destinationStationName?: string;
    originGeographicGroupName?: string;
    destinationGeographicGroupName?: string;
}

interface PriceAuthority {
    priceAuthorityOwnerIssuedName: string;
    priceAuthorityNumber: number;
    priceAuthorityItemNumber: number;
    prices: BnsfPrice[];
    priceAuthorityGroups?: any;
}

interface CarloadRatesSuccessResponse {
    status: string;
    httpStatus: number;
    message: {
        results: {
            priceAuthority: PriceAuthority;
        };
        errors: any[];
    };
}

interface CarloadRatesErrorResponse {
    status: string;
    httpStatus: number;
    message: {
        results: string;
        errors: any[];
    };
}

type CarloadRatesResponse = CarloadRatesSuccessResponse | CarloadRatesErrorResponse;

// ============================================================================
// Environment Validation
// ============================================================================

function loadEnvironment(): {
    baseUrl: string;
    clientCert: string;
    clientKey: string;
    ca?: string;
} {
    const baseUrl = process.env.BNSF_BASE_URL;
    const clientCert = process.env.BNSF_CLIENT_CERT_PEM;
    const clientKey = process.env.BNSF_CLIENT_KEY_PEM;
    const ca = process.env.BNSF_CA_PEM;

    if (!baseUrl) {
        console.error('❌ Error: BNSF_BASE_URL environment variable is required');
        process.exit(1);
    }

    if (!clientCert) {
        console.error('❌ Error: BNSF_CLIENT_CERT_PEM environment variable is required');
        process.exit(1);
    }

    if (!clientKey) {
        console.error('❌ Error: BNSF_CLIENT_KEY_PEM environment variable is required');
        process.exit(1);
    }

    return { baseUrl, clientCert, clientKey, ca };
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CliArgs {
    owner: string;
    number: string;
    item?: string;
}

function parseCliArgs(): CliArgs {
    try {
        const { values } = parseArgs({
            options: {
                owner: {
                    type: 'string',
                    short: 'o',
                },
                number: {
                    type: 'string',
                    short: 'n',
                },
                item: {
                    type: 'string',
                    short: 'i',
                },
            },
        });

        if (!values.owner || !values.number) {
            console.error('❌ Error: --owner and --number are required arguments');
            console.error('\nUsage:');
            console.error('  ts-node scripts/bnsf_carload_rates_smoke.ts --owner BNSF --number 4022 [--item 31750]');
            process.exit(1);
        }

        return {
            owner: values.owner,
            number: values.number,
            item: values.item,
        };
    } catch (error) {
        console.error('❌ Error parsing arguments:', error);
        console.error('\nUsage:');
        console.error('  ts-node scripts/bnsf_carload_rates_smoke.ts --owner BNSF --number 4022 [--item 31750]');
        process.exit(1);
    }
}

// ============================================================================
// API Call
// ============================================================================

function buildRequestBody(args: CliArgs): CarloadRatesRequestBody {
    // Parse number as integer (per BNSF spec, priceAuthorityNumber should be a number)
    const paNumber = parseInt(args.number, 10);
    if (isNaN(paNumber)) {
        console.error(`❌ Error: --number must be a valid integer (got: ${args.number})`);
        process.exit(1);
    }

    const body: CarloadRatesRequestBody = {
        priceAuthorityOwnerIssuedName: args.owner,
        priceAuthorityNumber: paNumber,
    };

    // Only include priceAuthorityItemNumber if provided
    // IMPORTANT: Use number if numeric, otherwise use "" - NEVER use null (causes 500 error)
    if (args.item) {
        const itemNum = parseInt(args.item, 10);
        body.priceAuthorityItemNumber = isNaN(itemNum) ? args.item : itemNum;
    }
    // If not provided, omit the field entirely (per BNSF documentation)

    return body;
}

async function callCarloadRatesAPI(
    env: ReturnType<typeof loadEnvironment>,
    body: CarloadRatesRequestBody
): Promise<{ status: number; data: CarloadRatesResponse }> {
    return new Promise((resolve, reject) => {
        const url = new URL('/v1/carload-rates', env.baseUrl);
        const requestData = JSON.stringify(body);

        const options: https.RequestOptions = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData),
            },
            cert: env.clientCert,
            key: env.clientKey,
            ca: env.ca,
            // Reject unauthorized certificates if CA is not provided
            rejectUnauthorized: !!env.ca,
        };

        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve({
                        status: res.statusCode || 0,
                        data: parsedData,
                    });
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(requestData);
        req.end();
    });
}

// ============================================================================
// Output Formatting
// ============================================================================

function isErrorResponse(response: CarloadRatesResponse): response is CarloadRatesErrorResponse {
    return typeof response.message.results === 'string';
}

function printResults(status: number, response: CarloadRatesResponse): void {
    console.log('\n' + '='.repeat(70));
    console.log('HTTP Status:', status);
    console.log('='.repeat(70));

    if (isErrorResponse(response)) {
        // Error response or "No rates found"
        console.log('\n📋 Message:', response.message.results);
    } else {
        // Success response with rate details
        const priceAuthority = response.message.results.priceAuthority;
        const prices = priceAuthority.prices;

        console.log(`\n✅ Price Authority: ${priceAuthority.priceAuthorityOwnerIssuedName} ${priceAuthority.priceAuthorityNumber}`);
        console.log(`   Item Number: ${priceAuthority.priceAuthorityItemNumber}`);
        console.log(`   Total Prices: ${prices.length}\n`);

        // Show first 10 prices as sample
        const samplesToShow = Math.min(prices.length, 10);
        console.log(`Showing first ${samplesToShow} rate(s):\n`);

        prices.slice(0, samplesToShow).forEach((rate: BnsfPrice, index: number) => {
            const origin = rate.originStationName || rate.originGeographicGroupName || 'Various';
            const dest = rate.destinationStationName || rate.destinationGeographicGroupName || 'Various';
            const originState = rate.originStateCode || '';
            const destState = rate.destinationStateCode || '';

            console.log(`Rate #${index + 1}:`);
            console.log(`  Amount:         $${rate.priceAuthorityPriceAmount} ${rate.unitOfMeasure}`);
            console.log(`  Effective:      ${rate.priceAuthorityPriceEffectiveDate}`);
            console.log(`  Expiration:     ${rate.priceAuthorityPriceExpirationDate}`);
            console.log(`  Origin:         ${origin}${originState ? ', ' + originState : ''}`);
            console.log(`  Destination:    ${dest}${destState ? ', ' + destState : ''}`);
            console.log('');
        });

        if (prices.length > samplesToShow) {
            console.log(`... and ${prices.length - samplesToShow} more rates.`);
        }
    }

    console.log('='.repeat(70) + '\n');
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log('🚂 BNSF Carload Rates Smoke Test\n');

    // Load environment variables
    const env = loadEnvironment();
    console.log('✅ Environment variables loaded');

    // Parse CLI arguments
    const args = parseCliArgs();
    console.log('✅ CLI arguments parsed');
    console.log(`   Owner: ${args.owner}`);
    console.log(`   Number: ${args.number}`);
    if (args.item) {
        console.log(`   Item: ${args.item}`);
    }

    // Build request body
    const requestBody = buildRequestBody(args);
    console.log('\n📦 Request Body:');
    console.log(JSON.stringify(requestBody, null, 2));

    // Call API
    console.log('\n🔄 Calling BNSF Carload Rates API...\n');

    try {
        const { status, data } = await callCarloadRatesAPI(env, requestBody);

        // Print results
        printResults(status, data);

        // Exit with non-zero code if HTTP status >= 400
        if (status >= 400) {
            console.error(`❌ Request failed with HTTP status ${status}`);
            process.exit(1);
        }

        console.log('✅ Request completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

// Run the script
main();
