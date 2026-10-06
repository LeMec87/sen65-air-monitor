# Home Assistant via ESPHome

Connect the monitor using Home Assistant's **built-in ESPHome integration**.
No HACS repository, custom component, installation ZIP or HA restart is needed
for this connection. The firmware already includes the native ESPHome API.
The ESPHome Device Builder is optional: it is a firmware editing/build tool,
not a requirement for adding an already-flashed board.

## Connect a board

1. Connect the monitor to Wi-Fi. Home Assistant must be able to reach it on
   the local network.
2. In HA, open **Settings → Devices & services**. If the ESPHome monitor appears
   under **Discovered**, select **Add** and confirm.
3. Otherwise, select **Add integration → ESPHome**. Enter the **board's** local
   IP address or `.local` hostname and port **6053**. Do not enter HA's address
   or a dashboard URL. The board's Device Information screen shows its IP;
   its web dashboard's Home Assistant tab also provides a **Copy host** button.
4. If asked for an encryption key, use the key configured on that board.
   The current public firmware configuration does not enable API encryption;
   leave the key blank for that configuration. Never invent or share a key.
5. Confirm setup and assign the device to an area. Open the device in the
   ESPHome integration and check that its readings update.

[Open ESPHome setup in HA](https://my.home-assistant.io/redirect/config_flow_start/?domain=esphome).
The My Home Assistant link may ask for your HA instance URL. Manual navigation
above works without that link.

Add each board separately. The firmware appends a MAC suffix to its hostname
so multiple monitors have distinct identities. A DHCP reservation helps keep
each board's IP stable. Do not add a second entry for a board already connected
through ESPHome; open its existing entry instead.

## What appears in Home Assistant

The board exposes eight sensor entities: **PM1.0, PM2.5, PM4.0, PM10,
Temperature, Humidity, VOC Index and NOx Index**. The SEN65 has no CO₂ sensor.
Sensor readings are sampled every five seconds and pushed through the native
API. Actual delivery can also depend on the component's update filtering.

The API also exposes **Temperature Unit** and **Firmware Update**. A **Factory
Reset** button is exposed too; it is destructive, not part of setup, and must
not be pressed to connect HA. Device-specific entity IDs are assigned by HA;
use the entity picker instead of copying assumed IDs from another board.

Temperature is exposed in Celsius by the sensor. HA's entity/unit preferences
control its presentation in HA; the Temperature Unit selector controls this
project's local display and dashboard.

## Sensor history

This project provides the ESPHome connection only. No dashboard linking,
iframe, custom sidebar panel or dashboard YAML is provided. The device's own
web dashboard and e-paper display remain available independently.

HA Recorder stores its own sensor history according to your HA configuration.
It does not import the board's existing 24-hour RAM graph. Recording begins
when the entities are connected and included in Recorder. The local charts
still use five-minute averages and reset when the board restarts.

## HTTPS and Cloudflare Tunnel

HA connects to the board's native API on the LAN. A remote browser connects to
HA through HA's existing authenticated HTTPS connection, including Cloudflare
Tunnel. The browser does not contact the board directly for these HA entities.
No board HTTPS certificate, separate Cloudflare route or iframe is required.

Keep the board's web server and TCP port 6053 private. Do not port-forward
them or publish the bare board through a tunnel. For stronger LAN protection,
configure a unique API encryption key in a private firmware configuration;
this requires reflashing and supplying the same key in HA. Do not commit keys
or Wi-Fi credentials to the public repository.

## Troubleshooting

- **Not discovered:** mDNS can be blocked across VLANs. Add ESPHome manually
  with the board's local IP. HA must still reach TCP port 6053.
- **Cannot connect:** check the board's current IP, power and Wi-Fi, then
  verify routing/firewall access from the HA host. A web page working on your
  laptop does not prove HA can reach the API.
- **Encryption/key error:** match the settings in the firmware actually
  installed on the board. Do not disable an existing encrypted setup to work
  around a missing key.
- **Wrong setup flow:** choose **ESPHome**, not the custom **SEN65 Air Monitor**
  integration. No custom integration files are needed.
- **HA status says Not found:** board-side discovery is informational, not a
  prerequisite. Native ESPHome setup can work without finding an HA instance.
  Connected means a native API client identifying itself as HA is connected;
  it does not verify a particular dashboard layout.
- **ESPHome Device Builder offers adoption:** adoption is optional and is
  separate from pairing the device. Do not replace the firmware with a generic
  ESP32 template; it would omit the sensor/display components and project UI.

## Moving from the custom integration

First add or verify the native ESPHome entry and confirm its sensor readings.
Keep any existing ESPHome entities, automations and dashboards. The old custom
integration is independent; migrating does not require resetting the board.

Once native ESPHome works, you may remove the **SEN65 Air Monitor custom
integration** entry if its sidebar panel is no longer needed. Removing its
last entry removes that panel. Removing a HACS repository alone is not the
same as removing an HA integration entry. Review any old panel dependencies
before uninstalling. Do not remove the native **ESPHome** entry.

The custom panel, HACS metadata and installation packages are no longer
maintained in the current repository. Removing files from GitHub does not
uninstall an existing HA component. Back up your HA configuration before
removing an old component, and retain the native ESPHome integration.

## Validation and references

A read-only native API test against Board 1 running firmware **0.3.7** and
ESPHome **2026.8.2** successfully listed all eight sensors and the three
controls. This verifies the board-side API, not setup inside a user's HA
instance. The revised setup page has separate UI/model tests; publishing or
previewing it does not install firmware on a board.

Official guides: [HA ESPHome integration](https://www.home-assistant.io/integrations/esphome/),
[ESPHome native API](https://esphome.io/components/api/).
