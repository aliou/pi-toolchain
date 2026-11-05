---
"@aliou/pi-toolchain": patch
---

Fix `wordToString` dropping `$'...'` (ANSI-C) and `$"..."` (locale) quoted arguments after the `@aliou/sh` 0.4.0 upgrade, and render extglob patterns through their structural word when present
