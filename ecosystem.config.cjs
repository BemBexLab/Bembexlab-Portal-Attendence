// Keep the .cjs entrypoint used by the deployment docs aligned with the
// canonical PM2 configuration. The shared config resolves paths from the
// repository root, so it works regardless of PM2's current directory.
module.exports = require('./ecosystem.config.js');
