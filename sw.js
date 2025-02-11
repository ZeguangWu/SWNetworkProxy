console.log("Service Worker start to initialize");

self.addEventListener("fetch", (event) => {
  event.respondWith(handleFetchEvent(event));
});

async function handleFetchEvent(event) {
  try {
    // if origin is the domain of the request, then allow the request
    if (
      event.request.url.includes("localhost") ||
      event.request.url.includes("127.0.0.1")
    ) {
      console.log("Service Worker: Localhost request, responded");
      return fetch(event.request);
    }

    const eventId = uuidv4();
    const { allowedOrigins, blockedOrigins } = await fetchAllowedOrigins(
      eventId
    );

    const urlOrigin = new URL(event.request.url).origin;
    console.log("Service Worker: URL origin is ", urlOrigin);

    if (blockedOrigins.includes(urlOrigin)) {
      console.log("Service Worker: Origin is blocked, responded");
      return new Response(null, { status: 403, statusText: "Blocked by SW" });
    }

    // if the origin is not in the allowed list in the localStorage, then pop up a dialog ask for user permission.
    if (!allowedOrigins.includes(urlOrigin)) {
      console.log("Service Worker: Origin not allowed, requesting permission");

      const eventId = uuidv4();
      const isAllowed = await confirmOriginAllowed(urlOrigin, eventId);

      if (isAllowed) {
        console.log(`${urlOrigin} is allowed by user, responded`);
        return fetch(event.request);
      } else {
        console.log(`${urlOrigin} is not allowed, blocked`);
        return new Response(null, { status: 403, statusText: "Blocked by SW" });
      }
    } else {
      console.log(`${urlOrigin} is in the allowed list, responded`);
      return fetch(event.request);
    }
  } catch (e) {
    console.error("Service Worker: Error handling fetch event", error);
    return new Response(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
}

function messageHandler(event) {
  const eventId = event.data.eventId;
  if (event.data.action === "getAllowedOrigins") {
    fetchAllowedOrigins.resolveCallbacks.get(eventId)?.(event.data.value);
  } else if (event.data.action === "confirmOriginAllowed") {
    confirmOriginAllowed.resolveCallbacks.get(eventId)?.(event.data.value);
  }
}

console.log("registering message event");
self.addEventListener("message", messageHandler);
console.log("register message event complete");

async function fetchAllowedOrigins(eventId) {
  return new Promise((resolve, reject) => {
    if (!self.registration.active) {
      reject("Service Worker is not active");
      return;
    }

    fetchAllowedOrigins.resolveCallbacks.set(eventId, resolve);

    // Send the request to the main thread
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) {
        clients[0].postMessage({
          eventId,
          action: "getAllowedOrigins",
        });
      } else {
        reject("No active clients found");
      }
    });
  });
}
fetchAllowedOrigins.resolveCallbacks = new Map();

async function confirmOriginAllowed(origin, eventId) {
  return new Promise((resolve, reject) => {
    if (!self.registration.active) {
      reject("Service Worker is not active");
      return;
    }

    confirmOriginAllowed.resolveCallbacks.set(eventId, resolve);

    // Send the request to the main thread
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) {
        clients[0].postMessage({
          eventId,
          action: "confirmOriginAllowed",
          origin,
        });
      } else {
        reject("No active clients found");
      }
    });
  });
}
confirmOriginAllowed.resolveCallbacks = new Map();

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (
      +c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
    ).toString(16)
  );
}

console.log("Service Worker init complete");
