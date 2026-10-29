export function pickArtwork(ids, currentId) {
    if (!ids.length) return null;

    const choices = ids.filter((id) => id !== currentId);
    const pool = choices.length ? choices : ids;
    return pool[Math.floor(Math.random() * pool.length)];
}

export function metObjectUrl(value) {
    const url = String(value || '').trim();

    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        const protocolOk = parsed.protocol === 'https:' || parsed.protocol === 'http:';
        const hostOk = host === 'www.metmuseum.org' || host === 'metmuseum.org';
        if (!protocolOk || !hostOk) return '';
        return url;
    } catch {
        return '';
    }
}

export function imageUrlFromRecord(record) {
    if (!record) return '';

    const small = String(record.primaryImageSmall || '').trim();
    const full = String(record.primaryImage || '').trim();
    return small || full;
}

export function toArtworkSummary(record) {
    return {
        objectID: record.objectID,
        primaryImageSmall: record.primaryImageSmall || '',
        primaryImage: record.primaryImage || '',
        title: record.title || '',
        period: record.period || '',
        objectDate: record.objectDate || '',
        culture: record.culture || '',
        creditLine: record.creditLine || '',
        objectURL: record.objectURL || '',
    };
}

export function readFreshArtworkCache(stored, now, maxAgeMs) {
    if (!stored || typeof stored.savedAt !== 'number' || !Array.isArray(stored.artworks)) return null;
    if (now - stored.savedAt > maxAgeMs) return null;

    return stored.artworks.filter((artwork) => imageUrlFromRecord(artwork) && artwork.objectID != null);
}

export function readShowableCache(stored, searchTotal) {
    if (!stored || stored.total !== searchTotal || !Array.isArray(stored.artworks)) return null;

    return stored.artworks.filter((artwork) => imageUrlFromRecord(artwork) && artwork.objectID != null);
}

export async function fetchWithRetry(url, fetchImpl = fetch, attempts = 3) {
    let lastError;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const response = await fetchImpl(url);
            if (response.status !== 429 && response.status < 500) return response;
            lastError = new Error(`Request failed with ${response.status}`);
        } catch (error) {
            lastError = error;
        }

        if (attempt < attempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
    }

    throw lastError;
}

export async function collectShowableArtworks(ids, fetchRecord, options = {}) {
    const concurrency = options.concurrency ?? 6;
    const isCancelled = options.isCancelled ?? (() => false);
    const showable = [];
    const unchecked = [];

    if (!ids.length || isCancelled()) return { showable, unchecked };

    let cursor = 0;

    async function worker() {
        while (!isCancelled()) {
            const index = cursor;
            cursor += 1;
            if (index >= ids.length) return;

            const id = ids[index];
            try {
                const record = await fetchRecord(id);
                if (isCancelled()) return;
                if (imageUrlFromRecord(record)) showable.push(record);
            } catch {
                if (!isCancelled()) unchecked.push(id);
            }
        }
    }

    const workers = Math.max(1, Math.min(concurrency, ids.length));
    await Promise.all(Array.from({ length: workers }, () => worker()));
    return { showable, unchecked };
}
