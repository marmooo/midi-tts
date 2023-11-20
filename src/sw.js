const CACHE_NAME = "2023-11-21 00:00";
const urlsToCache = [
  "/midi-tts/",
  "/midi-tts/index.js",
  "/midi-tts/mora.lst",
  "/midi-tts/Ritsu_v0.0.2.sf3",
  "/midi-tts/favicon/favicon.svg",
  "https://cdn.jsdelivr.net/npm/midi-writer-js@2.1.4/browser/midiwriter.min.js",
  "https://cdn.jsdelivr.net/npm/js-synthesizer@1.8.5/dist/js-synthesizer.min.js",
  "https://cdn.jsdelivr.net/npm/js-synthesizer@1.8.5/dist/js-synthesizer.worklet.min.js",
  "https://cdn.jsdelivr.net/npm/js-synthesizer@1.8.5/externals/libfluidsynth-2.3.0-with-libsndfile.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      );
    }),
  );
});
