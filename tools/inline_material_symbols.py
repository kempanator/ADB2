"""Embed the local Material Symbols sprite for file:// compatible SVG icons."""

from pathlib import Path
import re
import xml.etree.ElementTree as ET


START = "<!-- Material Symbols sprite: start -->"
END = "<!-- Material Symbols sprite: end -->"


def inline_into_page(sprite_path: Path, page_path: Path) -> None:
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    sprite = ET.parse(sprite_path).getroot()
    sprite.set("style", "position:absolute;width:0;height:0;overflow:hidden")
    sprite.set("focusable", "false")
    markup = ET.tostring(sprite, encoding="unicode")

    page = page_path.read_text(encoding="utf-8")
    pattern = re.compile(f"({re.escape(START)}).*?({re.escape(END)})", re.DOTALL)
    if len(pattern.findall(page)) != 1:
        raise ValueError(f"Expected one Material Symbols marker pair in {page_path}")
    page = pattern.sub(lambda match: f"{match.group(1)}\n  {markup}\n  {match.group(2)}", page)
    page_path.write_text(page, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    inline_into_page(root / "assets" / "material-symbols.svg", root / "index.html")
