// Local dashboard requests use the board's own HTTP endpoints.
(function () {
  'use strict';
  globalThis.airMonitorFetch = (...args) => fetch(...args);
})();
