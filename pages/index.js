import React, {useState, useEffect} from 'react';
import { SpeedInsights } from "@vercel/speed-insights/next"
import {
    pickArtwork,
    metObjectUrl,
    imageUrlFromRecord,
    toArtworkSummary,
    readFreshArtworkCache,
    collectShowableArtworks,
    fetchWithRetry,
} from '../lib/artwork.mjs';

const CACHE_KEY = 'peony-showable-artworks-v2';
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const OBJECT_CHECK_CONCURRENCY = 4;

function readStoredArtworks() {
    try {
        const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        return readFreshArtworkCache(stored, Date.now(), CACHE_MAX_AGE_MS);
    } catch {
        return null;
    }
}

function storeArtworks(artworks) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), artworks }));
    } catch {
        // The count stays in memory if the browser cannot store it.
    }
}

function imageLoads(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

const App = () => {

    const [artworks, setArtworks] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [artworkID, setArtworkID] = useState(null);


    useEffect(() => {
        let cancelled = false;

        async function loadArtwork() {
            const cached = readStoredArtworks();
            if (cached) {
                setArtworks(cached);
                return;
            }

            const ids = [];
            let offset = 0;
            let total = 0;

            try {
                do {
                    const response = await fetchWithRetry(
                        `https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImage=true&q=peony&limit=500&offset=${offset}`
                    );
                    if (!response.ok) throw new Error('The Met search could not be loaded.');
                    const data = await response.json();
                    if (cancelled) return;

                    total = data.total || 0;
                    const pageIds = Array.isArray(data.objectIDs) ? data.objectIDs : [];
                    if (!pageIds.length) throw new Error('The Met search ended before all records were listed.');
                    ids.push(...pageIds);
                    offset += pageIds.length;
                } while (offset < total);

                if (cancelled) return;

                let pending = [...new Set(ids)];
                let records = [];

                for (let round = 0; round < 4 && pending.length && !cancelled; round += 1) {
                    const result = await collectShowableArtworks(pending, async (id) => {
                        const response = await fetchWithRetry(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
                        if (response.status === 404) return null;
                        if (!response.ok) throw new Error(`Object ${id} could not be loaded.`);
                        return response.json();
                    }, {
                        concurrency: OBJECT_CHECK_CONCURRENCY,
                        isCancelled: () => cancelled,
                    });

                    records = records.concat(result.showable);
                    pending = result.unchecked;

                    if (pending.length && !cancelled) {
                        await new Promise((resolve) => setTimeout(resolve, 1000 * (round + 1)));
                    }
                }

                if (cancelled) return;
                if (pending.length) throw new Error('Some Met records could not be checked.');

                const showable = records.map(toArtworkSummary);
                storeArtworks(showable);
                setArtworks(showable);
            } catch (error) {
                console.error(error);
                if (!cancelled) setLoadFailed(true);
            }
        }

        loadArtwork();

        return () => {
            cancelled = true;
        };
    },[]);

    useEffect(() => {
        if (!artworks) return;

        setArtworkID((current) => {
            const ids = artworks.map((artwork) => artwork.objectID);
            if (typeof current === 'number' && ids.includes(current)) return current;
            return pickArtwork(ids, current);
        });
    }, [artworks]);


    const [images, setImages] = useState('');
    const [title, setTitle] = useState('');
    const [period, setPeriod] = useState('');
    const [objectDate, setObjectDate] = useState('');
    const [culture, setCulture] = useState('');
    const [creditLine, setCreditLine] = useState('');
    const [objectUrl, setObjectUrl] = useState('');

    const showAnother = () => {
        if (!artworks?.length) return;

        const nextId = pickArtwork(artworks.map((artwork) => artwork.objectID), artworkID);
        if (nextId != null && nextId !== artworkID) {
            setArtworkID(nextId);
        }
    };

    const skipBroken = (rejectedId) => {
        setArtworks((current) => {
            if (!current) return current;
            const next = current.filter((artwork) => artwork.objectID !== rejectedId);
            storeArtworks(next);
            return next;
        });
    };

    useEffect(() => {
        if (typeof artworkID !== 'number') return;

        const summary = artworks?.find((artwork) => artwork.objectID === artworkID);
        if (!summary) return;

        let cancelled = false;

        async function loadObject() {
            const imageUrl = imageUrlFromRecord(summary);
            const canShow = Boolean(imageUrl) && await imageLoads(imageUrl);
            if (cancelled) return;

            if (!canShow) {
                skipBroken(artworkID);
                return;
            }

            setImages(imageUrl);
            setTitle(summary.title || '');
            setPeriod(summary.period || '');
            setObjectDate(summary.objectDate || '');
            setCulture(summary.culture || '');
            setCreditLine(summary.creditLine || '');
            setObjectUrl(metObjectUrl(summary.objectURL));
        }

        loadObject();

        return () => {
            cancelled = true;
        };

    }, [artworkID, artworks]);


    const shownCount = artworks == null ? null : artworks.length;

    return (
        <>
            <header>
            <SpeedInsights />
            <div className="opening-title">
                <h1>The Peony Art Experience</h1>
                <p>
                    {loadFailed
                        ? <>The Met collection could not be reached. Refresh the page to try again.</>
                        : shownCount == null
                        ? <>Checking Met records for a working image from <a href="https://metmuseum.github.io/" target="_blank" rel="noopener noreferrer" tabIndex={1}> theMetAPI's </a>collection.</>
                        : <>Refresh to explore each of the {shownCount} images that include the Peony flower from <a href="https://metmuseum.github.io/" target="_blank" rel="noopener noreferrer" tabIndex={1}> theMetAPI's </a>collection.</>
                    }
                </p>
            </div>
            </header>
            <main>
            <div className="container">
                <div className="art">
                    <div className="work-title">This work is: {title}</div>
                    {images ? <img src={images} alt={title} onError={() => skipBroken(artworkID)} /> : null}
                    <div className="refresh-row">
                        <button type="button" className="refresh-button" onClick={showAnother} disabled={!artworks?.length} tabIndex={2}>New Peony piece?</button>
                    </div>
                    <div className="work-details">
                        {period ? <p>Period: {period}</p> : null}
                        {objectDate ? <p>Date: {objectDate}</p> : null}
                        {culture ? <p>Culture: {culture}</p> : null}
                        {creditLine ? (
                            <p className="credit-line">
                                Credit: {objectUrl ? <a href={objectUrl} target="_blank" rel="noopener noreferrer" tabIndex={3}>{creditLine}</a> : creditLine}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>
            </main>
            <footer>
                ©SarahP.Studio created by Sarah Peony <a className="portfolio-link" href="https://sarahp.studio" target="_blank" rel="noopener noreferrer" tabIndex={4}>Visit my Portfolio</a>
            </footer>
        </>

    );
};

export default App;
