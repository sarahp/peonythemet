import React, {useState, useEffect, useCallback} from 'react';
import {Button} from "@material-ui/core";


const App = () => {

    const [artworkIDs, setArtworkIDs] = useState([]);
    const [totalPages, setTotalPages] = useState([]);


    useEffect(() => {
        fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImage=true&q=peony')
            .then(response => {
                return response.json()
            })
            .then(Response => {
                setArtworkIDs(Response.objectIDs);
                setTotalPages(Response.total);
            });

    },[]);

    // Choose one piece to display.

    const [artworkID, setArtworkID] = useState([]);

    useEffect(() => {
        setArtworkID(artworkIDs[Math.floor(Math.random() * artworkIDs.length)]);
    }, [artworkIDs]);


    const [images, setImages] = useState([]);
    const [title, setTitle] = useState([]);

    useEffect(() => {
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
                <p>Refresh to explore each of the {totalPages} images that include the Peony flower from <a href="https://metmuseum.github.io/" target="_blank" rel="noopener noreferrer" tabIndex="1"> theMetAPI's </a>collection.</p>
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
                ©SarahP.Studio created by Sarah P. <Button variant="outlined"><a href="https://sarahp.studio" target="_blank" rel="noopener noreferrer" tabIndex="2">Visit my Portfolio</a></Button>
            </footer>
        </>

    );
};

export default App;