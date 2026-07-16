# Vendored libraries

These are committed to the repo on purpose: LoopCheck must work with zero
external requests at runtime — on a plant LAN, in a control room with no cell
signal, and for self-hosters with no reliable internet. Never replace these
with CDN `<script>` tags.

| File            | Library                                             | Version | License |
|-----------------|-----------------------------------------------------|---------|---------|
| `alpine.min.js` | [Alpine.js](https://github.com/alpinejs/alpine)     | 3.14.1  | MIT     |
| `qrcode.min.js` | [qrcodejs](https://github.com/davidshimjs/qrcodejs) | 1.0.0   | MIT     |

Only `labels.html` loads the QR library; every other page loads Alpine alone,
keeping each page well under the ~50 KB JS budget.

To upgrade: download the new minified build, replace the file, update this
table, and test the tag page on a phone before committing.
