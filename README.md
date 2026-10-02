# SEN65 Air Monitor

Independent firmware project for the Aether-compatible ESP32-C3 PCB with a
Sensirion SEN65 and a Topwin TWE0370NQN35-MNG-A0 e-paper display
(also named TWE0370NQN35-A0 in the supplied specification).
The firmware renders its interface at 416×240 pixels in landscape orientation.

The firmware is maintained in this repository and does not use the upstream
Aether OTA manifest. Updates are built locally and installed over USB or the
ESPHome OTA connection.

## Features

- SEN65 readings: PM1, PM2.5, PM4, PM10, temperature, humidity, VOC and NOx
- custom Space Grotesk e-paper dashboard
- date, local time and current weather icon
- weather location selectable in the dashboard: saved city or automatic IP-based location
- seven weather icons: sunny, partly cloudy, cloudy, light rain, heavy rain,
  thunderstorm and clear-night moon
- full-width 24-hour charts for particles, gases and climate; every sensor
  update contributes to a five-minute averaged history point
- low-flicker e-paper animation while the sensor starts
- local web dashboard and `/api/state`
- exact display capture at `/screen.pbm`
- ESPHome/Home Assistant API
- Wi-Fi onboarding through captive portal and Improv Serial/BLE

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

The device-information page places the hostname and IP address on separate
lines. The BOOT button cycles through overview, particles, gases, climate
and device information.

![Startup animation](docs/display/boot-animation.gif)

Individual display images and a local browser gallery are available in
[docs/display](docs/display/README.md).

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

Weather-code mapping and location validation can be tested without a board:

```bash
c++ -std=c++17 tests/weather_test.cpp -o /tmp/sen65-weather-test
/tmp/sen65-weather-test
```

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
