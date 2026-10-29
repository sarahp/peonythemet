import React, {useState, useEffect, useRef} from 'react';

function pickArtwork(ids, currentId) {
    if (!ids.length) return null;

    const choices = ids.filter((id) => id !== currentId);
    const pool = choices.length ? choices : ids;
    return pool[Math.floor(Math.random() * pool.length)];
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

    const [artworkIDs, setArtworkIDs] = useState([]);
    const [totalPages, setTotalPages] = useState([]);
    const excludedIDs = useRef(new Set());


    useEffect(() => {
        let cancelled = false;
        const limit = 500;

        async function loadArtwork() {
            const ids = [];
            let offset = 0;
            let total = 0;

            do {
                const response = await fetch(
                    `https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImage=true&q=peony&limit=${limit}&offset=${offset}`
                );
                const data = await response.json();
                if (cancelled) return;

                total = data.total || 0;
                if (Array.isArray(data.objectIDs)) {
                    ids.push(...data.objectIDs);
                }
                offset += limit;
            } while (offset < total);

            if (!cancelled) {
                setArtworkIDs(ids);
                setTotalPages(total);
            }
        }

        loadArtwork();

        return () => {
            cancelled = true;
        };
    },[]);

    // Choose one piece to display.

    const [artworkID, setArtworkID] = useState([]);

    useEffect(() => {
        if (!artworkIDs.length) return;
        setArtworkID(pickArtwork(artworkIDs));
    }, [artworkIDs]);


    const [images, setImages] = useState('');
    const [title, setTitle] = useState('');

    const showAnother = (currentId) => {
        const available = artworkIDs.filter((id) => !excludedIDs.current.has(id));
        const nextId = pickArtwork(available, currentId);
        if (nextId != null && nextId !== currentId) {
            setArtworkID(nextId);
        }
    };

    const skipBroken = (rejectedId) => {
        if (typeof rejectedId === 'number') {
            excludedIDs.current.add(rejectedId);
        }
        showAnother(rejectedId);
    };

    useEffect(() => {
        if (typeof artworkID !== 'number') return;

        let cancelled = false;

        async function loadObject() {
            try {
                const response = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${artworkID}`);
                const imageResponse = await response.json();
                if (cancelled) return;

                const imageUrl = imageResponse.primaryImageSmall || imageResponse.primaryImage || '';
                const canShow = Boolean(imageUrl) && await imageLoads(imageUrl);
                if (!canShow) {
                    if (!cancelled) skipBroken(artworkID);
                    else if (typeof artworkID === 'number') excludedIDs.current.add(artworkID);
                    return;
                }
                if (cancelled) return;

                setImages(imageUrl);
                setTitle(imageResponse.title || '');
            } catch {
                if (!cancelled) skipBroken(artworkID);
            }
        }

        loadObject();

        return () => {
            cancelled = true;
        };

    }, [artworkID]);


    return (
        <>
            <header>
            <div className="opening-title">
                <h1>The Peony Art Experience</h1>
                <p>Refresh to explore each of the {totalPages} images that include the Peony flower from <a href="https://metmuseum.github.io/" target="_blank" rel="noopener noreferrer" tabIndex={1}> theMetAPI's </a>collection.</p>
            </div>
            </header>
            <main>
            <div className="container">
                <div className="art">
                    <div className="work-title">This work is: {title}</div>
                    {images ? <img src={images} alt={title} onError={() => skipBroken(artworkID)} /> : null}
                    <div className="refresh-row">
                        <button type="button" className="refresh-button" onClick={() => showAnother(artworkID)} disabled={!artworkIDs.length} tabIndex={2}>New Peony piece?</button>
                    </div>
                </div>
            </div>
            </main>
            <footer>
                ©SarahP.Studio created by Sarah Peony <a className="portfolio-link" href="https://sarahp.studio" target="_blank" rel="noopener noreferrer" tabIndex={3}>Visit my Portfolio</a>
            </footer>
        </>

    );
};

export default App;