"""Generate 24x24 one-bit e-paper icons from the approved web SVGs.

Requires Pillow, resvg-py and Node.js. No network access is used.
"""
import io
import json
from pathlib import Path
import subprocess
from PIL import Image
import resvg_py

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'firmware/components/air_monitor_web_ui/web/app.js').read_text()
start = source.index('    function weatherIcon(kind)')
end = source.index('\n    }\n', start) + len('\n    }\n')
function = source[start:end]
svg_list = json.loads(subprocess.check_output(['node', '-e', function +
    ';console.log(JSON.stringify(Array.from({length:8},(_,i)=>weatherIcon(i))))']))
rows = []
for svg in svg_list:
    png = resvg_py.svg_to_bytes(svg_string=svg.replace('currentColor', '#000000'),
                                width=24, height=24, background='#ffffff')
    image = Image.open(io.BytesIO(png)).convert('L')
    assert image.size == (24, 24)
    pixels = image.load()
    data = []
    for y in range(24):
        for byte_x in range(3):
            value = 0
            for bit in range(8):
                value = (value << 1) | (pixels[byte_x * 8 + bit, y] < 128)
            data.append(value)
    assert sum(v.bit_count() for v in data) > 20
    rows.append(data)
out = ['#pragma once', '#include <cstdint>', '',
       '// Generated from approved web SVGs by tools/gen_weather_bitmaps.py.',
       '// Sunny, cloudy, light rain, moon, partly cloudy, heavy rain, storm, snow.',
       'static const uint8_t kWeatherPixelBitmaps[8][72] = {']
for data in rows:
    out.append('  {' + ','.join(f'0x{v:02x}' for v in data) + '},')
out += ['};', '']
(ROOT / 'firmware/components/air_monitor_epaper/weather_pixel_bitmaps.h').write_text('\n'.join(out))
print('Generated eight 24x24 one-bit weather icons (576 bytes).')
