---
id: oled-status-display
name: OLED Status Display
aliases: [oled text, ssd1306 display]
category: display-project
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno, oled-ssd1306]
concepts: [i2c-basics, display-output]
difficulty: medium
intent: draw text on an OLED display
source_book: Arduino-book-master, 101-book-master
source_files:
  - 8.3.4-u8gDrawStr.ino
  - 7.2.3-u8g2drawstr.ino
---

Use the appropriate OLED library, start the display in `setup()`, then draw strings or values inside the library's page/update loop.
