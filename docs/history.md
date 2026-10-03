# Interactive web history

Available from **v0.3.6**, with matching images in `dist/`. Older firmware does
not contain the History tab. Install the release to use it on a board.

![History inspector with sample readings](dashboard-history.jpg)

This browser preview uses sample data, not a live board capture.

## Inspect a moment

Open the board's dashboard and choose **History**, then **Particles**, **Gases**
or **Climate**. Click a legend button to hide/show a trace. Hidden traces remain
in memory and their selected readings are still shown, dimmed and marked
“hidden”. Colors and dash patterns distinguish overlapping traces.

Tap/click the plot to choose the nearest recorded sample, or move **Inspect a
recorded point**. The slider supports arrow keys. **Latest point** resumes
following the newest sample. **Refresh** fetches the selected category again;
while the tab is open, it refreshes every 30 seconds. This does not trigger a
sensor reading or add another history sample.

Particles share one µg/m³ scale. Gases use separate VOC and NOx index axes;
climate uses temperature on the left and relative humidity (%) on the right.
Separate axes scale independently: matching curve heights do not mean matching
values. Hiding a trace keeps the scales unchanged. Temperature follows the
dashboard's Celsius/Fahrenheit setting.

## What is recorded

The web inspector reads the **existing e-paper RAM history**, not a second
browser-side history. All eight SEN65 metrics are recorded together. The first
valid reading is stored immediately; subsequent sensor updates contribute to
the next five-minute average. Up to 288 points are retained. Sampling waits
until all metrics are valid; missing or invalid readings are not fabricated.

History is lost on reboot/update or power loss. A new board starts with a point,
not a full-day graph. After two points a line can be drawn. Samples older than
24 hours are omitted from the web response even if a sensor outage left them
in the ring. Empty history shows a waiting state; invalid values appear as gaps
and an em dash in the inspector. Network errors leave the last received history
visible with a stale warning.

The selected point is retained across refreshes. If it expires from the window,
the oldest available sample is selected with a notice. Times are estimated
using sample uptime and this browser's clock/timezone, not the board's display
timezone or Home Assistant's timezone. The backend handles the 32-bit uptime
counter wrapping. An incorrect browser clock produces incorrect wall-clock
labels, but does not change sample order or values.

## Local API

`GET /api/history?group=particles` (also `gases` or `climate`) returns one
category at a time to bound response memory. Invalid categories return 400.

```json
{
  "window_seconds": 86400,
  "sample_interval_seconds": 300,
  "temperature_unit": "C",
  "uptime_ms": 90000000,
  "metrics": ["temp", "rh"],
  "points": [[89700000, 23.4, 48.2], [90000000, 23.6, 48.0]]
}
```

The example is a climate response. Each row starts with sample uptime in
milliseconds, followed by values in `metrics` order. Temperature is always raw
Celsius in the API; the browser converts once if Fahrenheit is selected.
Non-finite values serialize as `null`. These local endpoints use the existing
device HTTP server and do not add authentication or Internet exposure.

## Development preview and tests

From the repository root, run `node tools/preview_dashboard.mjs` and open
`http://127.0.0.1:8768/`. The banner identifies sample data and simulated Home
Assistant status. No board or HA requests are made by the fixture server.
Options include `?history=overlap`, `?history=empty`, `?history=one` and
`?unit=F`. The fixture's state is shared by preview tabs, not isolated per tab.

Run `node tests/dashboard_models_test.js`, `python3 tests/web_bundle_test.py`
and the C++ history integration test documented in the README. They cover
category validation, missing values, uptime wrap, full/empty buffers, unit
conversion, nearest sample selection and deterministic compressed web assets.
`python3 tests/history_ring_test.py` exercises the actual sampling functions,
including every valid update contributing to the average and oldest/newest
ordering after the ring wraps.
