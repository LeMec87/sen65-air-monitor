# Topwin display specification notes

The project owner supplied `TWE0370NQN35-A0_SPEC_V0.1_20240929.pdf`, a
preliminary specification from Shenzhen Topwin Xingye Technology Limited,
version V0.1, dated 2024-09-29. Its cover names **TWE0370NQN35-MNG-A0**;
the general description uses **TWE0370NQN35-A0**. Both names are retained
here to make the document identifiable. This corrects the previously reported
TWE0370MNN30-FNG-A0 model.

## Specifications confirmed by the supplied document

| Property | Specification | Document section |
| --- | --- | --- |
| Display | 3.70-inch black-and-white e-paper | Cover, page 1 |
| Native resolution | 240 horizontal × 416 vertical pixels | Mechanical specification, page 4 |
| Landscape rendering | 416×240 pixels after rotation | Firmware configuration |
| Active area | 47.04×81.536 mm | Mechanical specification, page 4 |
| Outline dimensions | 53×92.99×0.87 mm | Mechanical specification, page 4 |
| Interface | SPI; BS low selects 4-wire mode | Pin assignment notes, page 7 |
| Connector | 24 pins | Pin assignment, page 6 |
| Reset | Active low, RSTN pin 10 | Pin assignment, page 6 |
| Busy | Active low, BUSYN pin 9 | Pin assignment notes, page 7 |
| Logic supply | 2.4-3.6 V, 3.0 V typical | Panel DC characteristics, page 7 |
| Operating temperature | 0-50°C | Panel DC characteristics, page 8 |
| Typical image update time | 2800 ms at 25°C | Optical specification, page 12 |
| Minimum SPI clock period | 250 ns, equivalent to a 4 MHz maximum clock | Interface timing, page 11 |

## Current firmware configuration

The firmware selects `GxEPD2_370_GDEY037T03` and rotation 1, producing the
416×240 landscape layout. The installed GxEPD2 driver describes a UC8253
controller, uses an active-low busy signal, and defaults to a 4 MHz SPI clock.
The display signals on the ESP32-C3 PCB are:

| Signal | GPIO |
| --- | --- |
| MOSI | 7 |
| SCK | 6 |
| CS | 5 |
| D/C | 4 |
| Reset | 3 |
| Busy | 1 |

The resolution, interface mode, busy polarity, and default SPI clock agree
with the supplied specification. These matches alone do not prove complete
driver compatibility. The document does not name the Topwin controller,
provide its command set, or specify fast partial refresh. Its 2800 ms image
update value must not be interpreted as a partial-refresh time.

Controller-specific initialization and waveform compatibility still require
confirmation from Topwin's controller documentation or reference driver.
The current driver and firmware have not been changed based on this model
correction. The manufacturer's PDF is not redistributed in this repository.
