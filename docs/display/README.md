# Display previews

Native resolution: 416×240 pixels. Images are produced with the original
firmware layout functions and the same Adafruit GFX bitmap fonts used by
the e-paper display, without a separately drawn mockup.

The project's display model is Topwin TWE0370MNN30-FNG-A0, as reported by
the project owner. These previews show the configured 416×240 landscape
rendering; they do not establish the panel's controller or refresh specifications.

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

The overview is a capture from a running device. The history pages use
synthetic values to show a complete 24-hour curve. Their geometry and fonts
come directly from the firmware. In the public device-information preview,
the IP address is masked, the hostname has no device-specific suffix, and
the dashboard QR code uses an example hostname instead of the device's IP.
The device itself still displays its real connection details.
The startup GIF shows the four animation frames at the
configured 900 ms interval; actual hardware refresh duration can vary.

![All display pages](display-pages.png)
