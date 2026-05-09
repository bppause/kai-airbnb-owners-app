// Entry point shim — actual server lives in server/index.js.
// Render's start command is `node server.js`; this require keeps that
// working without changing the deploy config. See
// docs/platform/PLATFORM_ARCHITECTURE.md §11 stage 5.
require('./server/index.js');
