# SEN65 Air Monitor

Independent firmware project for the Aether-compatible ESP32-C3 PCB with a
Sensirion SEN65 and a 416×240 GDEY037T03 e-paper display.

The firmware is maintained in this repository and does not use the upstream
Aether OTA manifest. Updates are built locally and installed over USB or the
ESPHome OTA connection.

## Features

- SEN65 readings: PM1, PM2.5, PM4, PM10, temperature, humidity, VOC and NOx
- custom Space Grotesk e-paper dashboard
- date, local time and current weather icon
- automatic city-level location via IP and weather via Open-Meteo
- day/night icons including sun, cloud, rain and moon
- full-width 24-hour charts for particles, gases and climate; every sensor
  update contributes to a five-minute averaged history point
- low-flicker e-paper animation while the sensor starts
- local web dashboard and `/api/state`
- exact display capture at `/screen.pbm`
- ESPHome/Home Assistant API
- Wi-Fi onboarding through captive portal and Improv Serial/BLE

## Hardware

- ESP32-C3-MINI-1, 4 MB flash
- Sensirion SEN65 on I²C: SDA GPIO10, SCL GPIO0
- GDEY037T03 e-paper display: MOSI 7, SCK 6, CS 5, DC 4, RST 3, BUSY 1
- boot button on GPIO9; short presses cycle through overview, particle,
  gas, climate and device-information pages

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
