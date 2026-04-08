---
id: rtc-digital-clock
name: RTC Digital Clock
aliases: [rtc clock, ds1307 clock]
category: module-project
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno, rtc-ds1307]
concepts: [i2c-basics]
difficulty: medium
intent: read date and time from a DS1307 RTC
source_book: Arduino-book-master, 101-book-master
source_files:
  - 8.2.2-1307Clock.ino
  - 2.9.3-RTC.ino
---

Set the time once, then use the RTC library to read hours, minutes, and seconds from the DS1307 over I2C.
