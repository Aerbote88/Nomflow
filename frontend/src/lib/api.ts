export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('/') ? endpoint : `/api/${endpoint}`;
    
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = Math.pow(2, attempt - 1) * 500; // 500ms, 1000ms, 2000ms
                console.log(`[API] Retrying ${endpoint} (attempt ${attempt}/${maxRetries}) after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });

            if (response.status === 401) {
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
                throw new Error('Unauthorized');
            }

            if (!response.ok) {
                // Retry on transient server errors
                if (attempt < maxRetries && [502, 503, 504].includes(response.status)) {
                    console.warn(`[API] Transient error ${response.status} on ${endpoint}`);
                    continue;
                }

                let errorMsg = 'API request failed';
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.detail || errorMsg;
                } catch (e) {
                    // ignore
                }
                throw new Error(errorMsg);
            }

            return response.json();
        } catch (err) {
            lastError = err as Error;
            // Only retry on network errors or transient server errors
            if (attempt < maxRetries && (err instanceof TypeError || (err instanceof Error && err.message.includes('API request failed')))) {
                continue;
            }
            throw err;
        }
    }

    throw lastError || new Error('API request failed after retries');
}

export const api = {
    get: <T>(endpoint: string, options?: RequestInit) =>
        apiFetch<T>(endpoint, { ...options, method: 'GET' }),
    post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
        apiFetch<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
    put: <T>(endpoint: string, body?: any, options?: RequestInit) =>
        apiFetch<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
    delete: <T>(endpoint: string, options?: RequestInit) =>
        apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};
