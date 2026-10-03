import os
import gzip
import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.const import CONF_ID
from esphome.components import sensor, web_server_base, update, select

# Make sure web_server_base and update core are loaded
AUTO_LOAD = ["web_server_base", "update", "json", "mdns", "api"]

_BASE_DIR = os.path.dirname(__file__)
_WEB_DIR = os.path.join(_BASE_DIR, 'web')


def _generate_html_header():
    """Read web/ sources, inline CSS/JS, and write the C++ header."""
    with open(os.path.join(_WEB_DIR, 'index.html'), 'r') as f:
        html = f.read()
    with open(os.path.join(_WEB_DIR, 'style.css'), 'r') as f:
        css = f.read()
    with open(os.path.join(_WEB_DIR, 'app.js'), 'r') as f:
        js = f.read()

    html = html.replace('<link rel="stylesheet" href="style.css">', f'<style>\n{css}\n</style>')
    html = html.replace('<script src="app.js"></script>', f'<script>\n{js}\n</script>')
    for name in ('transport.js', 'history.js', 'home-assistant.js'):
        with open(os.path.join(_WEB_DIR, name), 'r') as f:
            source = f.read()
        html = html.replace(f'<script src="{name}"></script>', f'<script>\n{source}\n</script>')

    # Serve pre-compressed bytes directly from flash. No runtime compression
    # and no full HTML heap copy; browsers transparently decode gzip.
    data = gzip.compress(html.encode('utf-8'), compresslevel=9, mtime=0)
    rows = [', '.join(f'0x{b:02x}' for b in data[i:i + 20]) for i in range(0, len(data), 20)]
    header = 'static const uint8_t INDEX_HTML_GZIP[] = {\n' + ',\n'.join(rows) + '\n};\n'
    with open(os.path.join(_BASE_DIR, 'air_monitor_web_ui_html.h'), 'w') as f:
        f.write(header)


# Generate the inlined HTML header before compilation
_generate_html_header()

air_monitor_ns = cg.esphome_ns.namespace("air_monitor")
AirMonitorWebUI = air_monitor_ns.class_("AirMonitorWebUI", cg.Component)

CONF_CO2 = "co2"
CONF_PM25 = "pm25"
CONF_TEMP = "temp"
CONF_RH = "rh"
CONF_PM1 = "pm1"
CONF_PM4 = "pm4"
CONF_PM10 = "pm10"
CONF_VOC = "voc"
CONF_NOX = "nox"
CONF_FW_UPDATE = "fw_update"
CONF_TEMP_UNIT_SWITCH = "temp_unit_switch"

CONFIG_SCHEMA = cv.Schema(
    {
        cv.GenerateID(CONF_ID): cv.declare_id(AirMonitorWebUI),

        cv.Optional(CONF_CO2): cv.use_id(sensor.Sensor),
        cv.Required(CONF_PM25): cv.use_id(sensor.Sensor),
        cv.Required(CONF_TEMP): cv.use_id(sensor.Sensor),
        cv.Required(CONF_RH): cv.use_id(sensor.Sensor),
        cv.Required(CONF_PM1): cv.use_id(sensor.Sensor),
        cv.Required(CONF_PM4): cv.use_id(sensor.Sensor),
        cv.Required(CONF_PM10): cv.use_id(sensor.Sensor),
        cv.Required(CONF_VOC): cv.use_id(sensor.Sensor),
        cv.Required(CONF_NOX): cv.use_id(sensor.Sensor),
        cv.Required(CONF_TEMP_UNIT_SWITCH): cv.use_id(select.Select),

        # Optional link to the update entity created by:
        # update:
        #   - platform: http_request
        #     id: aether_fw_update
        cv.Optional(CONF_FW_UPDATE): cv.use_id(update.UpdateEntity),
    }
).extend(cv.COMPONENT_SCHEMA)


async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)

    # Wire up all sensor pointers → set_co2, set_pm25, etc. in C++
    for key in [
        CONF_PM25,
        CONF_TEMP,
        CONF_RH,
        CONF_PM1,
        CONF_PM4,
        CONF_PM10,
        CONF_VOC,
        CONF_NOX,
    ]:
        s = await cg.get_variable(config[key])
        cg.add(getattr(var, f"set_{key}")(s))

    if CONF_CO2 in config:
        s = await cg.get_variable(config[CONF_CO2])
        cg.add(var.set_co2(s))

    # Wire up the temp unit select
    sw = await cg.get_variable(config[CONF_TEMP_UNIT_SWITCH])
    cg.add(var.set_temp_unit_switch(sw))

    if CONF_FW_UPDATE in config:
        fw = await cg.get_variable(config[CONF_FW_UPDATE])
        cg.add(var.set_fw_update(fw))
        cg.add(var.set_fw_update_component(fw))
        fw_id = config[CONF_FW_UPDATE].id
        cg.add(var.set_on_check_update(cg.RawExpression(f"[=]() {{ {fw_id}->check(); }}")))
