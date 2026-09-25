"""Build the local SVG sprite from Google Fonts Material Symbols Outlined.

Source: https://fonts.google.com/icons
Files: https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/
License: Apache License 2.0 (https://github.com/google/material-design-icons)
"""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET
from inline_material_symbols import inline_into_page


NAMES = """
add add_circle arrow_drop_down arrow_drop_up artist auto_fix_high bar_chart build
calendar_month cell_tower checklist database delete description dns download
drag_indicator edit_square favorite file_download filter_alt folder_open
format_list_numbered group info language link menu_book mic movie music_note
open_in_new pause person play_arrow playlist_play queue_music refresh repeat
restart_alt save search search_gear sell settings shuffle signal_cellular_alt skip_next
skip_previous sports_esports stop swap_horiz swap_vert table_chart timer
trending_up tune tv upload_file visibility visibility_off volume_off volume_up
""".split()


def fetch(name):
    url = f"https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/{name}/default/24px.svg"
    with urllib.request.urlopen(url, timeout=25) as response:
        data = response.read()
    svg = ET.fromstring(data)
    return name, svg


def main():
    with ThreadPoolExecutor(max_workers=8) as pool:
        icons = dict(pool.map(fetch, NAMES))
    root = ET.Element("svg", {"xmlns": "http://www.w3.org/2000/svg", "aria-hidden": "true"})
    for name in NAMES:
        source = icons[name]
        symbol = ET.SubElement(root, "symbol", {"id": name, "viewBox": source.attrib["viewBox"]})
        for child in source:
            child.tag = child.tag.rsplit("}", 1)[-1]
            symbol.append(child)
    output = Path(__file__).with_name("material-symbols.svg")
    ET.indent(root, space="  ")
    ET.ElementTree(root).write(output, encoding="unicode", xml_declaration=True)
    inline_into_page(output, output.parent.parent / "index.html")
    print(f"Saved {len(NAMES)} Google Material Symbols to {output}")


if __name__ == "__main__":
    main()
