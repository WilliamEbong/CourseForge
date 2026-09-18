# Vendored licences

No third-party source code is vendored into this repository; every dependency is installed from npm
(see [THIRD-PARTY.md](../../THIRD-PARTY.md)).

This folder holds licence texts for third-party material that ends up **inside released courses**:

| File | Material | Source | Why it is here |
|---|---|---|---|
| `lucide-ISC.txt` | Lucide icon SVG path data | `lucide-static` 1.47.0, copied verbatim from `node_modules/lucide-static/LICENSE` | Icons referenced by a course are inlined into its HTML. Each built course also carries the notice as an HTML comment, and RELEASE copies this licence to `release/licenses/lucide-ISC.txt` |

When a new dependency's code or assets would be embedded in courses, add its licence text here and a row above
(source, version, reason), and update `THIRD-PARTY.md`.
