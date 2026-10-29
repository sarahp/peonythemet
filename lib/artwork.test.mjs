import test from 'node:test';
import assert from 'node:assert/strict';
import {
    pickArtwork,
    metObjectUrl,
    imageUrlFromRecord,
    readShowableCache,
    readFreshArtworkCache,
    collectShowableArtworks,
    fetchWithRetry,
} from './artwork.mjs';

test('pickArtwork returns null when there are no works', () => {
    assert.equal(pickArtwork([], 4), null);
});

test('pickArtwork keeps the only available work', () => {
    assert.equal(pickArtwork([8], 8), 8);
});

test('pickArtwork chooses a different work when another one exists', () => {
    const ids = [1, 2, 3, 4];

    for (let attempt = 0; attempt < 30; attempt += 1) {
        const nextId = pickArtwork(ids, 2);
        assert.notEqual(nextId, 2);
        assert.ok(ids.includes(nextId));
    }
});

test('metObjectUrl accepts a Metropolitan Museum object URL', () => {
    const url = 'https://www.metmuseum.org/art/collection/search/62892';
    assert.equal(metObjectUrl(`  ${url}  `), url);
    assert.equal(metObjectUrl('https://metmuseum.org/art/collection/search/1'), 'https://metmuseum.org/art/collection/search/1');
});

test('metObjectUrl rejects anything that is not a Met http(s) URL', () => {
    assert.equal(metObjectUrl(''), '');
    assert.equal(metObjectUrl('not a url'), '');
    assert.equal(metObjectUrl('javascript:alert(1)'), '');
    assert.equal(metObjectUrl('https://example.com/art/collection/search/1'), '');
    assert.equal(metObjectUrl('http://images.metmuseum.org/photo.jpg'), '');
});

test('imageUrlFromRecord rejects an empty image and prefers the small image', () => {
    assert.equal(imageUrlFromRecord(null), '');
    assert.equal(imageUrlFromRecord({ primaryImageSmall: '', primaryImage: '  ' }), '');
    assert.equal(imageUrlFromRecord({
        primaryImageSmall: ' https://images.metmuseum.org/small.jpg ',
        primaryImage: 'https://images.metmuseum.org/full.jpg',
    }), 'https://images.metmuseum.org/small.jpg');
    assert.equal(imageUrlFromRecord({
        primaryImageSmall: '',
        primaryImage: 'https://images.metmuseum.org/full.jpg',
    }), 'https://images.metmuseum.org/full.jpg');
});

test('readFreshArtworkCache ignores an expired or empty-image list', () => {
    const now = 1_000_000;
    const stored = {
        savedAt: now - 1_000,
        artworks: [
            { objectID: 1, primaryImageSmall: '' },
            { objectID: 2, primaryImageSmall: 'https://images.metmuseum.org/a.jpg' },
        ],
    };

    assert.deepEqual(readFreshArtworkCache(stored, now, 5_000).map((artwork) => artwork.objectID), [2]);
    assert.equal(readFreshArtworkCache(stored, now, 500), null);
});

test('readShowableCache drops records without an image', () => {
    const stored = {
        total: 3,
        artworks: [
            { objectID: 1, primaryImageSmall: '', primaryImage: '' },
            { objectID: 2, primaryImageSmall: 'https://images.metmuseum.org/a.jpg' },
        ],
    };

    assert.equal(readShowableCache(stored, 4), null);
    assert.deepEqual(readShowableCache(stored, 3).map((artwork) => artwork.objectID), [2]);
});

test('collectShowableArtworks counts only records with an image', async () => {
    const records = {
        1: { objectID: 1, primaryImageSmall: '', primaryImage: '' },
        2: { objectID: 2, primaryImageSmall: 'https://images.metmuseum.org/a.jpg' },
        3: { objectID: 3, primaryImage: 'https://images.metmuseum.org/b.jpg' },
        4: null,
    };

    const result = await collectShowableArtworks([1, 2, 3, 4, 5], async (id) => {
        if (id === 5) throw new Error('missing');
        return records[id];
    });

    assert.deepEqual(result.showable.map((record) => record.objectID).sort(), [2, 3]);
    assert.deepEqual(result.unchecked, [5]);
});

test('fetchWithRetry retries a failed request', async () => {
    let calls = 0;
    const response = await fetchWithRetry('https://www.metmuseum.org/example', async () => {
        calls += 1;
        if (calls < 3) throw new Error('network');
        return { status: 200 };
    });

    assert.equal(calls, 3);
    assert.equal(response.status, 200);
});

test('collectShowableArtworks does not fetch when cancelled', async () => {
    let calls = 0;

    const result = await collectShowableArtworks([1, 2], async () => {
        calls += 1;
        return { objectID: 1, primaryImageSmall: 'https://images.metmuseum.org/a.jpg' };
    }, { isCancelled: () => true });

    assert.deepEqual(result, { showable: [], unchecked: [] });
    assert.equal(calls, 0);
});
