# Display previews

Native resolution: 416×240 pixels. Images are produced with the original
firmware layout functions and the same Adafruit GFX bitmap fonts used by
the e-paper display, without a separately drawn mockup.

The project's display is Topwin TWE0370NQN35-MNG-A0, also named
TWE0370NQN35-A0 in the supplied specification. Its native 240×416 pixels
match the configured 416×240 landscape rendering. These previews do not
establish controller or refresh compatibility; see the
[display specification notes](../topwin-display.md).

Open `index.html` locally to view the gallery. This is a static preview;
it does not connect to the device or change its settings.

| Page | Image |
| --- | --- |
| Startup | [boot.png](boot.png), [boot-animation.gif](boot-animation.gif) |
| Overview | [overview.png](overview.png) |
| Particles | [particles.png](particles.png) |
| Gases | [gases.png](gases.png) |
| Climate | [climate.png](climate.png) |
| Device information | [info.png](info.png) |
| Weather symbols | [weather-icons.png](weather-icons.png) |

The overview is a capture from a running device. The history pages use
synthetic values to show a complete 24-hour curve. Their geometry and fonts
come directly from the firmware. In the public device-information preview,
the IP address is masked, the hostname has no device-specific suffix, and
the dashboard QR code uses an example hostname instead of the device's IP.
The device itself still displays its real connection details.
The startup GIF shows the four animation frames at the
configured 900 ms interval; actual hardware refresh duration can vary.

![All display pages](display-pages.png)

## Weather icons (v0.3.0)

The display supports sunny, partly cloudy, cloudy, light rain, heavy rain,
thunderstorm, and a crescent moon for clear nights. This enlarged strip is
rendered with the actual firmware icon functions; the icons occupy an
18×18-pixel area on the device. Rain and thunderstorm icons remain visible
at night rather than being replaced by a moon. Fog and snow use the cloud
fallback within this seven-icon set.

![Display weather icons](weather-icons.png)

Choose **Weather** in the device dashboard to search for and save a city, or
retain automatic IP-based location. See the [weather settings guide](../weather.md).
