---
id: shift-registers
name: Shift Registers
aliases: [74hc595, serial to parallel, io expansion]
category: logic
boards: [arduino-uno]
related_components: [shift-register-74hc595]
common_issues:
  - Mixing up data, clock, and latch pins
  - Forgetting to provide VCC and GND
  - Expecting outputs to update before the latch signal
safety:
  - Keep output current within the IC limits
source_book: Arduino-book-master
source_files:
  - 5.3.12-74HC595.ino
---

Shift registers let one microcontroller send serial data and control many parallel outputs, which is useful when digital pins are limited.
