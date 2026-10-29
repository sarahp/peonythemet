import React, {useState, useEffect} from 'react';
import { SpeedInsights } from "@vercel/speed-insights/next"
import {
    pickArtwork,
    metObjectUrl,
    imageUrlFromRecord,
    fetchWithRetry,
} from '../lib/artwork.mjs';

const CACHE_KEY = 'peony-search-ids-v3';
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function readStoredIds() {
    try {
        const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (!stored || typeof stored.savedAt !== 'number' || !Array.isArray(stored.ids)) return null;
        if (Date.now() - stored.savedAt > CACHE_MAX_AGE_MS) return null;
        const ids = stored.ids.filter((id) => typeof id === 'number');
        return ids.length ? ids : null;
    } catch {
        return null;
    }
}

function storeIds(ids) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), ids }));
    } catch {
        // The list stays in memory if the browser cannot store it.
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

    const [artworkIDs, setArtworkIDs] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [artworkID, setArtworkID] = useState(null);


    useEffect(() => {
        let cancelled = false;

        async function loadArtwork() {
            const cached = readStoredIds();
            if (cached) {
                setArtworkIDs(cached);
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
                    if (!pageIds.length) break;
                    ids.push(...pageIds);
                    offset += pageIds.length;
                } while (offset < total);

                if (cancelled) return;
                if (!ids.length) throw new Error('The Met search returned no records.');

                const uniqueIds = [...new Set(ids)];
                storeIds(uniqueIds);
                setArtworkIDs(uniqueIds);
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
        if (!artworkIDs) return;

        setArtworkID((current) => {
            if (typeof current === 'number' && artworkIDs.includes(current)) return current;
            return pickArtwork(artworkIDs, current);
        });
    }, [artworkIDs]);


    const [images, setImages] = useState('');
    const [title, setTitle] = useState('');
    const [period, setPeriod] = useState('');
    const [objectDate, setObjectDate] = useState('');
    const [culture, setCulture] = useState('');
    const [creditLine, setCreditLine] = useState('');
    const [objectUrl, setObjectUrl] = useState('');

    const showAnother = () => {
        if (!artworkIDs?.length) return;

        const nextId = pickArtwork(artworkIDs, artworkID);
        if (nextId != null && nextId !== artworkID) {
            setArtworkID(nextId);
        }
    };

    const skipBroken = (rejectedId) => {
        setArtworkIDs((current) => {
            if (!current) return current;
            const next = current.filter((id) => id !== rejectedId);
            storeIds(next);
            return next;
        });
    };

    useEffect(() => {
        if (typeof artworkID !== 'number') return;

        let cancelled = false;

        async function loadObject() {
            try {
                const response = await fetchWithRetry(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${artworkID}`);
                if (cancelled) return;
                if (response.status === 404) {
                    skipBroken(artworkID);
                    return;
                }
                if (!response.ok) throw new Error(`Object ${artworkID} could not be loaded.`);

                const record = await response.json();
                const imageUrl = imageUrlFromRecord(record);
                const canShow = Boolean(imageUrl) && await imageLoads(imageUrl);
                if (cancelled) return;

                if (!canShow) {
                    skipBroken(artworkID);
                    return;
                }

                setImages(imageUrl);
                setTitle(record.title || '');
                setPeriod(record.period || '');
                setObjectDate(record.objectDate || '');
                setCulture(record.culture || '');
                setCreditLine(record.creditLine || '');
                setObjectUrl(metObjectUrl(record.objectURL));
            } catch (error) {
                console.error(error);
                if (!cancelled) skipBroken(artworkID);
            }
        }

        loadObject();

        return () => {
            cancelled = true;
        };

    }, [artworkID]);


    const shownCount = artworkIDs == null ? null : artworkIDs.length;

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
                        <button type="button" className="refresh-button" onClick={showAnother} disabled={!artworkIDs?.length} tabIndex={2}>New Peony piece?</button>
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
