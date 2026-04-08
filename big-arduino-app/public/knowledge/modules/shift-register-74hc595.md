---
id: shift-register-74hc595
name: 74HC595 Shift Register
aliases: [74hc595, shift register]
category: modules
pins:
  - name: DS
    function: Serial data input
    notes: Data line from the MCU
  - name: SH_CP
    function: Shift clock
    notes: Clocks bits into the register
  - name: ST_CP
    function: Latch clock
    notes: Updates the outputs
  - name: Q0
    function: Output channel
    notes: One of the parallel outputs
common_issues:
  - Mixing up clock and latch pins
  - Forgetting to provide power and ground
safety:
  - Respect the chip's output current limits
boards: [arduino-uno]
related_components: [arduino-uno, led-5mm]
source_book: Arduino-book-master
---

The 74HC595 lets Arduino control many digital outputs by shifting bits serially into the chip and latching them to the outputs.
