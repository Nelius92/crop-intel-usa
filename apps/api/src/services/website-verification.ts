function normalizeDomain(urlString: string | null | undefined): string | null {
    if (!urlString) return null;
    try {
        const url = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`);
        return url.hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        return null;
    }
}

function extractNameTokens(name: string): string[] {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 3)
        .filter((token) => !['grain', 'company', 'co', 'corp', 'inc', 'llc', 'the', 'and', 'farmers', 'cooperative'].includes(token));
}

export interface WebsiteVerificationResult {
    domain: string | null;
    ok: boolean;
    scoreAdjustment: number;
    reason: string;
}

export async function verifyWebsiteForBuyer(buyerName: string, websiteUrl: string | null | undefined): Promise<WebsiteVerificationResult> {
    const domain = normalizeDomain(websiteUrl);

    if (!domain) {
        return { domain: null, ok: false, scoreAdjustment: -15, reason: 'Missing or invalid website domain' };
    }

    const tokens = extractNameTokens(buyerName);
    const domainText = domain.replace(/\.[a-z]+$/i, '').replace(/[^a-z0-9]/g, ' ');
    const tokenMatch = tokens.some((token) => domainText.includes(token));

    let bodyMatch = false;
    try {
        const response = await fetch(`https://${domain}`, {
            signal: AbortSignal.timeout(8_000),
            headers: {
                'User-Agent': 'CornIntelBuyerSync/1.0 (+local)',
            },
            redirect: 'follow',
        });

        if (response.ok) {
            const html = (await response.text()).slice(0, 25_000).toLowerCase();
            bodyMatch = tokens.some((token) => html.includes(token));
        }
    } catch {
        // Domain fetch failures are common; don't fail the entire sync.
    }

    if (tokenMatch || bodyMatch) {
        return { domain, ok: true, scoreAdjustment: 10, reason: 'Website domain/body matches facility brand' };
    }

    return { domain, ok: false, scoreAdjustment: -20, reason: 'Website domain does not match facility brand' };
}

export function normalizeWebsite(urlString: string | null | undefined): string | null {
    if (!urlString) return null;
    try {
        const url = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`);
        url.hash = '';
        url.search = '';
        return url.toString();
    } catch {
        return null;
    }
}
