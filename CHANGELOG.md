# Changelog

## 0.3.6 - 2026-10-03

- add a web History inspector using the existing e-paper RAM samples: trace
  toggles, plot/keyboard/slider selection, selected values and independent axes
- expose one bounded history category per request with sample uptime metadata,
  stale-data warnings and Celsius/Fahrenheit conversion in the browser
- discover local IPv4 Home Assistant mDNS advertisements asynchronously and
  distinguish discovery from a currently connected HA-identified API client
- add optional ESPHome setup guidance and an exact embedded Webpage dashboard,
  including YAML export, manual HA URL fallback and HTTPS/network limitations
- compress embedded web assets at build time to keep the firmware within its
  existing OTA partition; add fixture previews and regression tests

- refresh all web-dashboard screenshots and package matching OTA/factory images,
  manifest and checksums

The release passes build and local regression/browser tests but has not been
installed or tested on a physical board/HA instance. Publishing does not flash
a board, enrol it in Home Assistant or create a dashboard automatically.

## 0.3.5 - 2026-10-03

- use three-pixel lines and matching legend samples on all e-paper history graphs
- add numeric value scales, units and a time-axis title to every graph
- give particles a shared µg/m³ scale, gases separate VOC/NOx index scales,
  and climate separate temperature and humidity scales
- keep temperature labels and plotted values consistent with Celsius/Fahrenheit
- preserve negative temperatures, avoid negative particle/index scales, and
  keep nearby tick labels distinct at zero, constant and high readings
- refresh the native firmware-rendered graph previews and add axis regression tests
- package matching v0.3.5 OTA/factory images, manifest and checksums

Version 0.3.4 was a private particle-line test build, not a published release.
The final release uses 0.3.5 so devices running that test can find it as an update.

## 0.3.3 - 2026-10-03

- redesigned the local dashboard with dark glass panels and the approved blue,
  green, amber, orange and red palette
- grouped all eight readings into indoor climate, airborne particles and gas
  indices, with clearer labels and larger climate readings
- added responsive navigation, keyboard focus, reduced-motion support and
  a system-font fallback for Space Grotesk
- show an explicit Offline state when sensor polling fails
- added a small e-paper overview download badge when a newer firmware release
  has valid manifest metadata; installation remains manual
- added sample dashboard and native firmware-rendered update-icon previews
- packaged matching v0.3.3 OTA/factory images, manifest and checksums

## 0.3.2 - 2026-10-02

- fix manual update checks, installation acknowledgements and weather refresh
  returning HTTP 500 despite accepting the action: ESPHome 2026.8.2's ESP32
  web-server status mapper does not support HTTP 202; queued actions now return 200
- use supported 400/409 statuses for rejected methods, busy requests and
  disconnected update checks, retaining descriptive JSON errors
- add a regression check for unsupported custom HTTP statuses

## 0.3.1 - 2026-10-02

- enabled this project's GitHub firmware manifest and dashboard check/install controls
- report check progress and errors; reject unapproved download URLs and dashboard downgrades
- verify HTTPS server certificates and the OTA image's manifest checksum
- point the Instructions QR at the public project guide instead of a wrong local hostname
- give QR codes a proper white quiet zone without a surrounding black border
- restyle connected and offline Device Information with Space Grotesk,
  inset dividers, separate address rows and consistently aligned QR blocks
- document the one-time ESPHome/USB bootstrap needed on v0.3.0 and older boards

## 0.3.0 - 2026-10-02

- added a Weather dashboard tab with city search and automatic IP-location mode
- persisted the weather location and mode across restarts
- expanded display icons to sun, partly cloudy, cloudy, light rain, heavy rain,
  thunderstorm and a moon for clear nights
- added current location, condition, last-update age, stale/error status and
  rate-limited manual weather refresh
- clear the old location's icon when selecting a different city

## 0.2.2 - 2026-10-02

- placed hostname and IP address on separate lines in device information
- added original firmware-rendered display previews and startup animation

## 0.2.1 - 2026-10-02

- combined each category into one full-width graph
- added monochrome line styles and compact live-value legends
- included every sensor update in five-minute averaged history points
- added a low-flicker sensor-start animation

## 0.2.0 - 2026-10-02

- added boot-button navigation across overview, particles, gases, climate and
  device-information pages
- added RAM-backed 24-hour graphs sampled every five minutes
- grouped PM1, PM2.5, PM4 and PM10 on the particle page
- grouped VOC and NOx on the gas page
- grouped temperature and humidity on the climate page

## 0.1.0 - 2026-10-02

- initial independent SEN65 firmware project
- custom Space Grotesk e-paper UI
- date/time and current weather with day/night icons
- local display screenshot endpoint
- removed dependency on the upstream OTA service
