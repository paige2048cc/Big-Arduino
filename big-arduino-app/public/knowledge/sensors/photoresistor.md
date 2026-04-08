---
id: photoresistor
name: Photoresistor
aliases: [ldr, light sensor]
category: sensors
pins:
  - name: TERM1
    function: Passive terminal
    notes: Use in a voltage divider
  - name: TERM2
    function: Passive terminal
    notes: Use in a voltage divider
common_issues:
  - Wiring it without a reference resistor
  - Expecting a direct digital HIGH/LOW output
safety:
  - Keep voltages within the analog input range
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno]
source_book: Arduino-book-master
---

A photoresistor changes resistance with light level and is typically read through a voltage divider on an analog pin.
