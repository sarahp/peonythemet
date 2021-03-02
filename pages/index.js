import React, {useState, useEffect, useCallback} from 'react';
import '../styles/Home.module.css'


const App = () => {

    const [artworkIDs, setArtworkIDs] = useState([]);
    const [totalPages, setTotalPages] = useState([]);


    useCallback(useEffect(() => {
        fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImage=true&q=peony')
            .then(response => {
                // console.log(response.json());
                return response.json()
            })
            .then(Response => {
                setArtworkIDs(Response.objectIDs);
                setTotalPages(Response.total);
            });

    },[]), []);

    // Choose one piece to display.

    const [artworkID, setArtworkID] = useState([]);

    useEffect(() => {
        setArtworkID(artworkIDs[Math.floor(Math.random() * artworkIDs.length)]);
    }, [artworkIDs]);

    console.log(artworkID);


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
            <div className="opening-title">
                <h1>The Peony Art Experience</h1>
                <p>Refresh to explore each of the {totalPages} images that include the Peony flower from <a href="https://metmuseum.github.io/" target="_blank"> theMetAPI's </a>collection.</p>
            </div>
            <div className="container">
                <div className="art">
                    <div className="work-title">This work is: {title}</div>
                    <img src={images} alt={title} />
                </div>
            </div>
        </>

    );
};

export default App;