---
id: oled-ssd1306
name: OLED SSD1306 Module
aliases: [oled, ssd1306, oled display]
category: modules
pins:
  - name: GND
    function: Ground
    notes: Common reference
  - name: VCC
    function: Power input
    notes: Module supply
  - name: SCL
    function: I2C clock
    notes: Connect to board SCL
  - name: SDA
    function: I2C data
    notes: Connect to board SDA
common_issues:
  - Picking the wrong library family
  - Using the wrong address or reset assumptions
safety:
  - Confirm module voltage compatibility
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno]
source_book: Arduino-book-master, 101-book-master
---

SSD1306 OLED modules can display text and simple graphics with much sharper contrast than character LCDs.
