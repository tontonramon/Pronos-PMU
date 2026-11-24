const C="pronos-v1",F=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F))));
self.addEventListener("fetch",e=>{
  if(e.request.url.includes("pmu.fr"))return;           // l'API n'est jamais mise en cache
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
