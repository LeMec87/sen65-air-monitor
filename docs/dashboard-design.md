# Dark glass dashboard — firmware v0.3.7 / HA v0.1.2

The dark glass design was introduced in v0.3.3. These current screenshots
include the History inspector, simplified Home Assistant setup and shared HA
panel. They use sample
readings and simulated controls, not an installed board. Publishing a release
does not install it on a device; these additions have not been verified on hardware.

![Dark glass dashboard with sample readings](dashboard-overview.jpg)

### Mobile

![Compact mobile dashboard with five aligned navigation icons](dashboard-mobile.jpg)

The mobile menu omits visual labels but keeps accessible button names. All five
56-pixel targets remain on one row without overlap or horizontal overflow.

### Weather

![Dark glass Weather dashboard with sample conditions](weather-dashboard.jpg)

Berlin and the weather conditions are fixture data, not the owner's location
or live weather. See the [weather guide](weather.md) for real-device settings.

### Updates

![Dark glass Updates dashboard with simulated v0.3.7 status](updates-dashboard.jpg)

Firmware versions and update status in this preview are simulated; it is not
proof of a physical-board installation. See the [update guide](updates.md).

### History

![History inspector with sample readings and a hidden trace](dashboard-history.jpg)

The selected point and hidden trace are fixture data. Colors, dash patterns,
click selection and keyboard/slider inspection help separate overlapping traces.
The real page reads the board's existing RAM history. See [History](history.md).

### Home Assistant

![Simplified Home Assistant setup with simulated discovery](dashboard-home-assistant.jpg)

“Detected” is simulated in this screenshot. It is not proof of a real discovery,
integration or embedded HA dashboard. See [Home Assistant setup](home-assistant.md)
for installation, administrator access and HA's authenticated transport.

![Shared dashboard in the simulated HA panel](dashboard-ha-panel.jpg)

![Five aligned icons in the mobile HA panel](dashboard-ha-panel-mobile.jpg)

The panel previews use simulated HA commands and sample boards. Real HA serves
the same dashboard through its authenticated connection and registers a sidebar
panel. No separate board HTTPS address is needed. HA installation remains a
separate validation step; the fixture is not a full HA frontend.

HA v0.1.2 fixes the dashboard clipped to a 150-pixel strip in an auto-height
custom-panel wrapper. These updated screenshots use that auto-height constraint;
the fixture no longer sets a height on the component to conceal sizing failures.
Desktop and 320/393-pixel mobile resize checks pass; confirmation in the user's
real HA installation after updating remains a separate step.

## Visual direction

- Dark neutral background (`#0B111B`) with soft blue, green and orange glows.
- Translucent glass panels, subtle borders and rounded corners.
- Palette: red `#C31725`, blue `#2585D9`, green `#51B666`, amber `#F28F16`,
  orange `#F26513`.
- Blue leads navigation and actions; green marks live status and gas-card
  accents; orange marks particle-card accents; amber highlights weather and
  available updates. Red marks errors, with a lighter red text tint for contrast.
  Card accent colors identify groups, not air-quality classifications.
- Space Grotesk with a system-font fallback when Google Fonts is unavailable.
- Light text and controlled color accents; English labels throughout.
- Readings grouped into indoor climate, airborne particles and gas indices.
- Desktop text navigation; five equal, icon-only mobile targets (56 pixels high),
  with accessible names and no wrapping/overlap. Temperature controls are at
  least 44 pixels high.
- Visible keyboard focus, reduced-motion support and an opaque fallback for
  browsers without background blur.

## E-paper update indicator

![Native firmware-rendered overview with update indicator](display/overview-update.png)

A small download symbol appears on the overview only when the configured
firmware updater reports a newer release with an approved download URL and
valid checksum metadata, without a reported error. This validates the manifest
metadata; the image itself is checksum-verified during installation.

The symbol uses an available header gap, or a reserved position below the
header when the date and climate values leave insufficient room. It is cleared
on the next normal redraw when no verified update remains available. It does
not install an update automatically or flash an animation.

## Validation

The firmware compiles with the pinned ESPHome toolchain. HA backend tests use
the 2026.9.4 APIs with mocked LAN responses; transport tests check request/reply
guards and board switching. Browser checks cover
Environment, History, Weather, Home Assistant and Updates at narrow mobile widths, including horizontal
overflow and temperature-control target sizes. Native display renders compare
the overview with and without the indicator using the firmware's actual GFX
fonts. Release packaging checks the OTA partition size, manifest and image
checksums. Hardware installation and physical e-paper readability checks remain
separate steps; no board was updated as part of this publication.
