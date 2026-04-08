---
id: rtc-ds1307
name: DS1307 RTC Module
aliases: [rtc, ds1307, clock module]
category: modules
pins:
  - name: GND
    function: Ground
    notes: Common reference
  - name: VCC
    function: Power input
    notes: Module supply
  - name: SDA
    function: I2C data
    notes: Connect to board SDA
  - name: SCL
    function: I2C clock
    notes: Connect to board SCL
common_issues:
  - Forgetting to set the time once before reading
  - Swapping SDA and SCL
safety:
  - Check battery polarity if the module includes backup power
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno]
source_book: Arduino-book-master, 101-book-master
---

The DS1307 RTC keeps time even when the board is powered down, making it useful for clocks and timestamped logging.
