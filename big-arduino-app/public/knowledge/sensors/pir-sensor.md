---
id: pir-sensor
name: PIR Motion Sensor
aliases: [pir, motion sensor]
category: sensors
pins:
  - name: VCC
    function: Power input
    notes: Module supply
  - name: OUT
    function: Digital motion output
    notes: HIGH when motion is detected
  - name: GND
    function: Ground
    notes: Common reference
common_issues:
  - Expecting instant stable output without warm-up time
  - Forgetting the sensor output is digital
safety:
  - Power down before rewiring module pins
boards: [arduino-uno]
related_components: [arduino-uno]
source_book: Arduino-book-master
---

PIR sensors detect motion by responding to changes in infrared radiation from moving people or animals.
