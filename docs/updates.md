# Firmware updates and recovery

Dashboard updates are supported from **v0.3.1**, with corrected request statuses
in **v0.3.2**. Boards running v0.3.0 or older have no GitHub updater: install
v0.3.2 or newer once via ESPHome OTA or USB.
Uploading a release to GitHub does not upgrade a board by itself.

## Check and install

1. Connect the board to Wi-Fi with internet access. Open its local dashboard.
2. Select **Firmware & Updates**, then **Check for updates**.
3. When a newer version is available, press **Update to …** to install it.
4. Keep power connected throughout installation. The board restarts when done;
   reload the dashboard and confirm the current version.

The firmware also checks shortly after startup (initially after 10 seconds,
with network retries) and every six hours. Checks never install automatically.
Wi-Fi and saved weather settings are retained by a normal OTA update; the
RAM-only graph history starts over after the restart. Do not use factory reset
or erase-flash for a routine update.

The board reads this project's [manifest](../dist/manifest.json) over HTTPS
from GitHub's raw-file host. The manifest identifies an ESP32-C3 OTA image,
release version and MD5 checksum. HTTPS server certificates are verified; MD5
checks transfer integrity, **not** a separate cryptographic publisher signature.
The dashboard only accepts a numerically newer `major.minor.patch` release,
a version-matching OTA path in this repository, and valid checksum metadata.
SHA-256 checksums for manual verification are in [SHA256SUMS](../dist/SHA256SUMS).
The Home Assistant update entity is also available; dashboard-specific
version and URL guards apply to the local dashboard API.

## Problems

- **Initial update required:** use ESPHome OTA or USB once. An old dashboard
  may instead show an unknown version or a check that never finds an update.
- **Update error / timeout:** verify internet access, then check again.
  Invalid metadata or failed manifest requests disable installation.
- **v0.3.1 rejects the check despite fetching a version:** that release returns
  an incorrect HTTP error after accepting a queued check or install. Wait for
  the next dashboard poll; when v0.3.2 is offered, install it. An installation
  may briefly report an error before progress appears. ESPHome OTA is also
  available to skip this old response-status issue.
- **Up to date:** no numerically newer release was found; equal or older
  manifest versions cannot be installed from the dashboard.
- **Page disconnects during installation:** wait for the board to restart,
  reopen its local address and check the displayed firmware version.
- **Board cannot start or join Wi-Fi:** use USB recovery below. Recovery that
  erases flash removes saved settings.

## One-time bootstrap or manual OTA

Follow the [build instructions](../README.md#build), then update over Wi-Fi:

```bash
.venv/bin/esphome upload firmware/sen65-air-monitor.yaml \
  --device sen65-air-monitor-XXXXXX.local
```

Replace the example hostname with the hostname shown on your board. USB
recovery uses the release's `factory` image at address `0x0` (not its OTA image):

```bash
.venv/bin/esptool --chip esp32c3 --port /dev/cu.usbmodemXXXX \
  write-flash 0x0 dist/sen65-air-monitor-v0.3.2-factory.bin
```

If an erase is necessary for recovery, use the erase-flash command in the
README first; this removes settings. Keep an older factory image from `dist/`
as a USB rollback option. Dashboard downgrades are intentionally blocked.

## Publish a release (maintainers)

1. Bump `fw_version` in the YAML and update documentation/changelog.
2. Compile with the pinned ESPHome version and run the tests.
3. Package the resulting images and manifest together:

```bash
python3 tools/prepare_release.py \
  --build-path /tmp/sen65-air-monitor-build
python3 tests/release_manifest_test.py
```

4. Commit the versioned OTA/factory binaries, `dist/manifest.json`,
   `dist/SHA256SUMS`, source and docs in the same GitHub commit.
5. Verify the public manifest and OTA checksum after pushing.

Packaging refuses to overwrite a previously published version with different
binary contents. The manifest always points at a versioned OTA filename, not
a mutable generic firmware file. No upstream Aether service is used.

Queued successful check/install requests return HTTP 200 with `{"ok":true}`;
this acknowledges acceptance, not completion. Poll `/api/state` for the result.
Busy or disconnected checks return 409. Unsupported methods return 400 with
`method_not_allowed` because the pinned ESP32 server supports a limited status set.

![Live dashboard confirming firmware v0.3.2 and a successful GitHub check](updates-dashboard.jpg)

## Validation of v0.3.2

Compilation and partition size checks, release metadata/checksum tests,
version/URL validation tests, native display rendering and QR decoding, and
dashboard fixture tests are performed before publication. Publication alone
does not install firmware; a physical-board update is a separate step.
Phone scanning on the physical e-paper panel should also be checked after
installation because lighting and panel refresh can affect readability.

On 2026-10-02, a physical ESP32-C3 board was upgraded from v0.2.2 to v0.3.1
using ESPHome OTA, then from v0.3.1 to v0.3.2 through the dashboard's GitHub
download path. The download completed, passed OTA integrity validation and
restarted successfully. The installed board reported current/latest v0.3.2,
completed a manual check without an HTTP error, retained Celsius, delivered
all eight SEN65 readings and fetched live weather with no reported error.
The screenshot above is from that board; no private IP or location is shown.
