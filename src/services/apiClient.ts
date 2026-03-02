const API_BASE =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '';

function buildUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    if (API_BASE) {
        return new URL(path, API_BASE.endsWith('/') ? API_BASE : `${API_BASE}/`).toString();
    }
    return path;
}

export async function apiGetJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(buildUrl(path), {
        ...init,
        headers: {
            Accept: 'application/json',
            ...(init?.headers || {}),
        },
    });

    if (!response.ok) {
        throw new Error(`API GET ${path} failed (${response.status})`);
    }

    return response.json() as Promise<T>;
}

export async function apiPostJson<T>(
    path: string,
    body: unknown,
    init?: RequestInit
): Promise<T> {
    const response = await fetch(buildUrl(path), {
        method: 'POST',
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(init?.headers || {}),
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`API POST ${path} failed (${response.status})`);
    }

    return response.json() as Promise<T>;
}
