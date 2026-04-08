---
id: display-output
name: Display Output
aliases: [lcd display, oled display, text output]
category: output
boards: [arduino-uno, arduino-101]
related_components: [lcd1602-i2c, oled-ssd1306]
common_issues:
  - Initializing the wrong library for the display type
  - Using the wrong I2C address
  - Expecting the display to work without power and shared ground
safety:
  - Check display voltage requirements before wiring
source_book: Arduino-book-master, 101-book-master
source_files:
  - 8.1.5-LCDHelloworld.ino
  - 8.3.4-u8gDrawStr.ino
  - 7.2.3-u8g2drawstr.ino
---

Character LCDs and OLED modules let Arduino projects show text, values, and status messages directly in hardware.
