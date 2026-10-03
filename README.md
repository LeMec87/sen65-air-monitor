# SEN65 Air Monitor

Independent firmware project for the Aether-compatible ESP32-C3 PCB with a
Sensirion SEN65 and a Topwin TWE0370NQN35-MNG-A0 e-paper display
(also named TWE0370NQN35-A0 in the supplied specification).
The firmware renders its interface at 416×240 pixels in landscape orientation.

The firmware is maintained in this repository and does not use the upstream
Aether OTA manifest. From **v0.3.1**, the local dashboard checks this project's
GitHub manifest and can install newer releases over Wi-Fi. USB and ESPHome
OTA remain available for initial installation and recovery.

## Using your monitor

1. On an unconfigured board, join its setup Wi-Fi network and open
   `http://192.168.4.1/` to enter your Wi-Fi credentials.
2. Once connected, press BOOT to reach **Device Information**. Scan
   **DASHBOARD** to open the board's local page while on the same network.
   **INSTRUCTIONS** opens this public guide and requires internet access.
3. Use short BOOT presses to cycle through overview, particles, gases,
   climate and device information. Each graph covers up to the last 24 hours.
4. In the dashboard, choose Celsius/Fahrenheit, save a weather city, or use
   **Firmware & Updates** to check for a newer release.

Boards running **v0.3.0 or older need one initial installation of v0.3.2 or
newer via ESPHome OTA or USB** before dashboard updates can work. Publishing
new files on GitHub never installs them automatically. See the
[update and recovery guide](docs/updates.md).

## Features

The **v0.3.7** source and matching OTA/factory images are available in `dist/`.
Install the release on a board for the compact mobile menu and simplified HA setup.
The separate **HA integration v0.1.1** works with board firmware v0.3.6 or later.
Build, backend and browser tests pass; real-board/HA installation testing remains.

- SEN65 readings: PM1, PM2.5, PM4, PM10, temperature, humidity, VOC and NOx
- custom Space Grotesk e-paper dashboard
- date, local time and current weather icon
- weather location selectable in the dashboard: saved city or automatic IP-based location
- seven weather icons: sunny, partly cloudy, cloudy, light rain, heavy rain,
  thunderstorm and clear-night moon
- full-width 24-hour charts for particles, gases and climate; every sensor
  update contributes to a five-minute averaged history point
- three-pixel graph lines with numeric scales, units and time-axis labels (v0.3.5+)
- low-flicker e-paper animation while the sensor starts
- local web dashboard and `/api/state`
- dark glass web interface with grouped readings and responsive navigation (v0.3.3+)
- small e-paper overview indicator for an available newer firmware release (v0.3.3+)
- checksum-checked GitHub updates with HTTPS certificate verification (v0.3.1+)
- exact display capture at `/screen.pbm`
- ESPHome/Home Assistant API
- interactive web History: toggle traces and inspect recorded points (v0.3.6+)
- local Home Assistant discovery and optional integration setup
- the exact dashboard through HA's authenticated connection, with automatic
  sidebar registration and a multi-board selector (HA integration v0.1.1)
- one-row icon-only mobile navigation (firmware v0.3.7 / HA integration v0.1.1)
- Wi-Fi onboarding through captive portal and Improv Serial/BLE

## Web dashboard

From **v0.3.3**, the local dashboard uses a dark glass design with blue, green,
amber, orange and red accents. Environment shows all eight readings grouped
into climate, particles and gas indices; Weather manages the outdoor location;
Updates checks and installs firmware from this repository.

![Dark glass dashboard with sample readings](docs/dashboard-overview.jpg)

This is a browser preview with sample data, not a capture from an installed
board. Card colors distinguish metric groups, not air-quality classifications.
Space Grotesk falls back to a system font without internet access.
See the [dashboard design and validation notes](docs/dashboard-design.md).

From **v0.3.6**, the dashboard also includes **History** and **Home Assistant**.
History uses the board's existing five-minute RAM samples, with legend toggles
and click/slider inspection. From **v0.3.7**, HA setup is reduced to installing
the integration once, then adding the monitor. Mobile navigation uses five
aligned icons with accessible names; desktop navigation retains text labels.
See [interactive history](docs/history.md) and [Home Assistant setup](docs/home-assistant.md).

### Home Assistant: the same dashboard, no extra HTTPS address

Install the `custom_components/sen65_air_monitor` integration, restart HA and
add your monitor under **Settings → Devices & services**. The **SEN65 Air Monitor**
sidebar panel appears automatically and supports multiple boards. The browser
uses HA's authenticated connection; HA contacts the board on the LAN. No board
subdomain, certificate or additional Cloudflare route is needed.

Download the [HA v0.1.1 installation ZIP](dist/home-assistant/sen65-air-monitor-ha-v0.1.1.zip)
or add this repository to HACS as an **Integration** custom repository.
It is not in the default HACS catalogue. The first version is administrator-only
because it includes device controls. Keep native ESPHome for sensor entities
and automations. HA API tests use **2026.9.4** with mocked boards, not a real-user
HA installation. See the [installation and security guide](docs/home-assistant.md).

![Shared dashboard in the simulated HA panel](docs/dashboard-ha-panel.jpg)

![Compact icon-only mobile panel](docs/dashboard-ha-panel-mobile.jpg)

![Interactive History with a hidden trace and selected sample](docs/dashboard-history.jpg)

![Simplified Home Assistant setup with simulated local discovery](docs/dashboard-home-assistant.jpg)

All screenshots use sample data, not proof of a real board installation or HA
pairing. The panel fixture does not reproduce HA's outer sidebar or login.

For a safe sample-data preview, run `node tools/preview_dashboard.mjs` from
the repository root and open `http://127.0.0.1:8768/`. It makes no requests to
a real board or HA server. Preview query options are documented in the guides.
To preview the panel too, run `node tools/preview_ha_panel.mjs 8769` in another
terminal and open `http://127.0.0.1:8769/`.

## Weather settings

Open the device's local dashboard and select **Weather**. Choose **Automatic
(IP-based)**, or choose **Choose a city**, search for a city or postal code,
select the matching city/country, and press **Save location**. The mode and
chosen coordinates are stored on the board and survive a restart. Each board
keeps its own location setting. Changing the weather location does not change
the clock's configured timezone.

Available from **v0.3.0**; install the firmware on a board to use these settings.
Weather refreshes every 15 minutes and after saving a location. The tab also
provides manual refresh, update age and error status. Clear nights show a moon;
cloudy and rainy nights retain their weather icon. Internet access is required.

These enlarged icons are rendered by the actual e-paper drawing functions:

![Display weather icons](docs/display/weather-icons.png)

See the [weather settings guide](docs/weather.md) for the dashboard preview,
complete icon mapping, local API, connectivity/security and validation notes.

## Display layouts

These previews use the firmware's original drawing functions and bitmap fonts
at the native 416×240 resolution. The overview is a device capture; graph
histories are illustrative sample data, not recorded measurements.

![Display pages](docs/display/display-pages.png)

From **v0.3.5**, all three history pages use thicker lines and labeled axes.
Particles share a µg/m³ scale. Gases use VOC on the left and NOx on the right;
climate uses temperature on the left and humidity on the right. Temperature
follows the selected Celsius/Fahrenheit setting. Each value axis scales to its
history, so heights on different axes are not directly comparable.

The device-information page uses Space Grotesk, inset dividers and two aligned
QR blocks. Hostname and IP address remain on separate lines. Public preview
connection details are anonymized; the board shows its real addresses.

![Startup animation](docs/display/boot-animation.gif)

Individual display images and a local browser gallery are available in
[docs/display](docs/display/README.md).

In v0.3.3 and newer, the overview shows a small download symbol when a newer
firmware release has valid manifest metadata. Checks do not install updates
automatically. The symbol is only available after installing v0.3.3; older
boards can still find the release through their existing dashboard updater.

![Native firmware-rendered overview with update indicator](docs/display/overview-update.png)

This indicator preview uses the firmware drawing functions and sample readings,
with the update-available flag enabled. The other display previews above are
unchanged; they do not show an available update.

## Hardware

- ESP32-C3-MINI-1, 4 MB flash
- Sensirion SEN65 on I²C: SDA GPIO10, SCL GPIO0
- Topwin TWE0370NQN35-MNG-A0 3.7-inch black-and-white e-paper display:
  MOSI GPIO7, SCK GPIO6, CS GPIO5, DC GPIO4, RST GPIO3, BUSY GPIO1
- boot button on GPIO9; short presses cycle through overview, particle,
  gas, climate and device-information pages

The currently configured display driver is `GxEPD2_370_GDEY037T03` with
rotation 1. `GDEY037T03` is the driver identifier, not the installed panel's
part number. The supplied Topwin specification confirms 240×416 native pixels
and a typical image update time of 2.8 seconds at 25°C. It does not identify
the controller or specify fast partial-refresh timing, so those aspects of
driver compatibility remain unconfirmed. See the
[Topwin display specification notes](docs/topwin-display.md) for details.

## Build

Python 3.11+ is recommended.

```bash
python3 -m venv .venv
.venv/bin/pip install esphome==2026.8.2 pillow
.venv/bin/esphome config firmware/sen65-air-monitor.yaml
.venv/bin/esphome compile firmware/sen65-air-monitor.yaml
```

The build produces:

- `/tmp/sen65-air-monitor-build/.pioenvs/sen65-air-monitor/firmware.factory.bin`
- `/tmp/sen65-air-monitor-build/.pioenvs/sen65-air-monitor/firmware.ota.bin`

Set `AIR_MONITOR_BUILD_PATH` to use a different build directory.

Verified release binaries are also stored in `dist/`, together with SHA-256
checksums. Use the `factory` image at address `0x0` for a clean installation;
use the `ota` image only for an existing compatible installation.

The chart history is kept in RAM to avoid unnecessary flash wear. It starts
again after a reboot and reaches the full 24-hour window after 288 samples.

## Install

Weather mapping and firmware version/download validation can be tested without
a board:

```bash
c++ -std=c++17 tests/weather_test.cpp -o /tmp/sen65-weather-test
/tmp/sen65-weather-test
c++ -std=c++17 tests/firmware_release_test.cpp -o /tmp/sen65-release-test
/tmp/sen65-release-test
python3 tests/release_manifest_test.py
python3 tests/dashboard_assets_test.py
python3 tests/history_axes_test.py
node tests/dashboard_models_test.js
python3 tests/web_bundle_test.py
python3 tests/history_ring_test.py
c++ -std=c++17 tests/history_integration_test.cpp -o /tmp/sen65-history-test
/tmp/sen65-history-test
```

On macOS, if the C++ compiler cannot find standard headers, add
`-isystem "$(xcrun --show-sdk-path)/usr/include/c++/v1"` to the C++ commands.
The release-manifest test intentionally requires the YAML version to match the
published binaries; an unreleased version bump will fail that check until
release packaging is performed. Do not overwrite an existing release binary.

First installation or recovery over USB:

```bash
.venv/bin/esptool --chip esp32c3 --port /dev/cu.usbmodemXXXX erase-flash
.venv/bin/esptool --chip esp32c3 --port /dev/cu.usbmodemXXXX \
  write-flash 0x0 firmware.factory.bin
```

Update a configured device over Wi-Fi:

```bash
.venv/bin/esphome upload firmware/sen65-air-monitor.yaml \
  --device sen65-air-monitor-XXXXXX.local
```

For dashboard updates and release packaging, see [docs/updates.md](docs/updates.md).

## Fonts

Generated Space Grotesk GFX headers live under
`firmware/components/air_monitor_epaper/fonts/`. Regenerate them with:

```bash
.venv/bin/python tools/gen_gfx_fonts.py \
  firmware/components/air_monitor_epaper/fonts
```

## Origin and license

This is adapted from Enrique Neyra's Aether project. See [NOTICE.md](NOTICE.md)
for attribution and a summary of the changes. The adapted project remains
licensed under CC BY-NC-SA 4.0; commercial use is not granted. See [LICENSE](LICENSE).

Space Grotesk is licensed separately under the SIL Open Font License; see
`assets/fonts/OFL-Space-Grotesk.txt`.
