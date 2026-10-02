# Changelog

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
