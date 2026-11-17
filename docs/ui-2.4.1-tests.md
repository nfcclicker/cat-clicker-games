# Ver.2.4.1 UI verification

Baseline: Ver.2.4 main `111493cb83c0e52139cdf2df0ede6a3288665710`.

## Automated checks

- Chrome and Edge headless: all five tabs at 320, 375, 390 and 430 CSS px; horizontal overflow, 44px navigation targets, header height, final content visible above navigation.
- Same seeded Ver.2.4 save was loaded through the v9-to-v10 Service Worker update. Navigation preserved its progress exactly before intentional setting changes.
- Stage lock/clear/selected cards; 24-fish grid, rarity filter and detail/back; daily/weekly/achievement tabs.
- Aquarium animation start/stop, viewing mode, six background previews, sheet dismissal and rapid tab switching.
- Menu records/titles/sound/help, transfer-code copy via mocked clipboard, preview and confirmed restoration.
- Repeated starts, normal/gold/boot score calculation, pause/resume and completion; navigation hidden throughout play.
- Multiple tabs, takeover, abandoned-lease expiry, stale tab completion prevention, offline reload, 30/35-second completion and restoration conflict rejection.
- Existing Node suites: aquarium, aquarium-balance, autosave-and-transfer, fish-and-stages, save-and-calendar, security.
- JavaScript syntax and Git whitespace checks.

No changes to game.js, cat-face.js, fish IDs, save keys, progress/validation/backup/codec/session/access logic. NFC access restriction remains disabled. Cache version is v10 and ui.js is precached.

Screenshots were captured before/after using the same test fixture (Lv.20); the old menu comparison is the previous settings dialog.

## Limits

Real iPhone Safari/Android devices, physical home-indicator safe areas, native clipboard/share menus and WebKit were not available for verification. CSS includes safe-area-inset-bottom. Desktop headless viewport emulation does not establish real-device compatibility or low-end hardware performance. Actual audio output and NFC hardware were not exercised.