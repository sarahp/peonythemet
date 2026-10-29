import React, {useState, useEffect} from 'react';


const App = () => {

    const [artworkIDs, setArtworkIDs] = useState([]);
    const [totalPages, setTotalPages] = useState([]);


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
        setArtworkID(artworkIDs[Math.floor(Math.random() * artworkIDs.length)]);
    }, [artworkIDs]);


    const [images, setImages] = useState([]);
    const [title, setTitle] = useState([]);

    useEffect(() => {
        if (typeof artworkID !== 'number') return;

        fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${artworkID}`)
            .then(response2 =>{
                return response2.json()
            })
            .then(imageResponse => {
                setImages(imageResponse.primaryImageSmall);
                setTitle(imageResponse.title);
            })

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
                    <img src={images} alt={title} />
                </div>
            </div>
            </main>
            <footer>
                ©SarahP.Studio created by Sarah Peony <a className="portfolio-link" href="https://sarahp.studio" target="_blank" rel="noopener noreferrer" tabIndex={2}>Visit my Portfolio</a>
            </footer>
        </>

    );
};

export default App;