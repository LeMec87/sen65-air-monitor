# Pixel-glass dashboard — firmware v1.0.0

The approved v1.0.0 design keeps every existing monitor function and introduces
pixel-glass styling. These screenshots include the History inspector and
built-in ESPHome setup guidance. They use sample
readings and simulated controls, not an installed board. Publishing a release
does not install it on a device; these additions have not been verified on hardware.

![Pixel-glass dashboard with sample readings](dashboard-overview.jpg)

### Mobile

![Compact mobile dashboard with five aligned navigation icons](dashboard-mobile.jpg)

The mobile menu omits visual labels but keeps accessible button names. All five
52-pixel-high targets remain on one row without overlap or horizontal overflow.

### Weather

![Pixel-glass Weather dashboard with sample conditions and snow legend](weather-dashboard.png)

Berlin and the weather conditions are fixture data, not the owner's location
or live weather. See the [weather guide](weather.md) for real-device settings.

### Updates

![Pixel-glass Updates dashboard with simulated v1.0.0 status](updates-dashboard.jpg)

Firmware versions and update status in this preview are simulated; it is not
proof of a physical-board installation. See the [update guide](updates.md).

### History

![History inspector with sample readings and a hidden trace](dashboard-history.jpg)

The selected point and hidden trace are fixture data. Colors, dash patterns,
click selection and keyboard/slider inspection help separate overlapping traces.
The real page reads the board's existing RAM history. See [History](history.md).

### Home Assistant

![Built-in ESPHome setup with simulated discovery](dashboard-home-assistant.png)

“Detected” is simulated in this screenshot. It is not proof of a real discovery,
integration or an HA dashboard. See [Home Assistant via ESPHome](home-assistant.md)
for native sensor pairing, history and safe migration. No HACS installation is
required. ESPHome does not automatically copy the glass dashboard into HA.

Only native ESPHome pairing is provided. There is no dashboard linking or
custom HA panel in the current project.

## Visual direction

- Dark blue gradient background (`#0B111B`) and primary panels (`#213147`).
- Square translucent glass panels, inset borders and pixel-style icons.
- Palette: red `#C72C24`, green `#448F46`, yellow `#DCC152`, powder blue
  `#B7C7D9` and near-white `#F2F7FC`.
- All reading cards share the same glass background. Their top bands and labels
  indicate Good, Moderate or Poor; invalid readings are neutral. These are
  project guidance, not an official AQI or health limits. The dashboard's
  expandable explanation gives every threshold.
- Sixtyfour for headings and the product title; Space Grotesk for values/body.
  Both use fallback fonts when Google Fonts is unavailable.
- Light text and controlled color accents; English labels throughout.
- Readings grouped into indoor climate, airborne particles and gas indices.
- Desktop text navigation; five equal, icon-only mobile targets (52 pixels high),
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

Release images use the pinned ESPHome toolchain. Previous release binaries
remain immutable. Browser checks cover the ESPHome connection page, discovery,
offline states and narrow layouts. Screenshots contain sample data, not proof
of HA pairing. Hardware installation remains a separate step.

The v1.0.0 build succeeds with ESPHome 2026.8.2: the OTA image is 1,786,768
bytes within the 1,835,008-byte application partition. Packaging/checksum,
embedded web bundle, native ESPHome UI, graph-axis and history-ring checks pass.
At 320 and 393 pixels, all five mobile controls are on one row with no
horizontal overflow. Browser checks confirm trace hiding and keyboard point
selection. This publication does not include flashing or hardware validation.
