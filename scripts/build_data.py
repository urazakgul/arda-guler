import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "sofascore_arda_guler.json"
OUT = ROOT / "assets" / "data.js"
CLUB = "Real Madrid"


def convert(match):
    home = match["Home"] == CLUB
    return {
        "d": match["Date"],
        "c": match["Comp"],
        "o": match["Away"] if home else match["Home"],
        "v": "H" if home else "A",
        "f": match["HomeGoals"] if home else match["AwayGoals"],
        "x": match["AwayGoals"] if home else match["HomeGoals"],
        "r": match["Result"],
        "m": match["Min"],
        "g": match["Gls"],
        "a": match["Ast"],
        "e": match["Note"],
    }


def main():
    raw = json.loads(SRC.read_text(encoding="utf-8"))
    rows = sorted((convert(m) for m in raw if m.get("Played")), key=lambda r: r["d"])
    last = date.fromisoformat(rows[-1]["d"])
    as_of = f"{last.day} {last.strftime('%b %Y')}"
    body = ",\n".join(
        "    " + json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows
    )
    OUT.write_text(
        "window.DATA = {\n"
        f'  asOf: "{as_of}",\n'
        "  matches: [\n"
        f"{body}\n"
        "  ]\n"
        "};\n",
        encoding="utf-8",
        newline="\n",
    )
    goals = sum(r["g"] for r in rows)
    assists = sum(r["a"] for r in rows)
    minutes = sum(r["m"] for r in rows)
    print(f"{len(rows)} matches, {goals} goals, {assists} assists, {minutes} minutes (as of {as_of})")


if __name__ == "__main__":
    main()
