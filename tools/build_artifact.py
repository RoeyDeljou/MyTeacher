#!/usr/bin/env python3
"""בונה קובץ HTML יחיד לפרסום כ-Artifact ב-claude.ai מתוך אותם קבצי מקור של ה-PWA.
הפלט: dist/artifact.html (CSS ו-JS מוטמעים, בלי Service Worker ו-Manifest)."""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text(encoding="utf-8")

body = re.search(r"<!--APP-BODY-START-->(.*)<!--APP-BODY-END-->", html, re.S).group(1)
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
css = (ROOT / "css" / "app.css").read_text(encoding="utf-8")
fonts = re.search(r'(<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]+>)', html).group(1)

js_parts = []
for src in scripts:
    code = (ROOT / src).read_text(encoding="utf-8")
    js_parts.append(f"<script>\n/* {src} */\n{code.replace('</script', '<\\/script')}\n</script>")

out = f"""<title>Moon Prep</title>
<meta name="claude:viewport-fit-sides" content="cover">
{fonts}
<style>
{css}
</style>
<div dir="rtl" lang="he">
{body}
</div>
<script>document.documentElement.setAttribute("dir", "rtl"); document.documentElement.setAttribute("lang", "he");</script>
{chr(10).join(js_parts)}
"""

dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
(dist / "artifact.html").write_text(out, encoding="utf-8")
print(f"wrote {dist / 'artifact.html'} ({len(out.encode('utf-8')) // 1024} KB)")
