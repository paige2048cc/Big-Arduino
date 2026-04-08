---
id: i2c-basics
name: I2C Basics
aliases: [i2c, sda scl, wire library]
category: communication
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno, lcd1602-i2c, oled-ssd1306, rtc-ds1307]
common_issues:
  - Swapping SDA and SCL
  - Forgetting to share ground
  - Using the wrong I2C address in code
safety:
  - Keep module voltage compatible with the board
source_book: Arduino-book-master, 101-book-master
source_files:
  - 5.3.4-TWImaster.ino
  - 5.3.4-TWIslave.ino
  - 2.9.3-RTC.ino
---

I2C lets multiple modules share two signal wires: `SDA` for data and `SCL` for clock. On Arduino UNO, these are typically `A4` and `A5`.
