---
id: ir-led
name: IR LED Emitter
aliases: [infrared led, ir emitter]
category: output
pins:
  - name: ANODE
    function: Positive input
    notes: Drive through a resistor
  - name: CATHODE
    function: Ground return
    notes: Connect to ground
common_issues:
  - Forgetting the resistor
  - Trying to drive the LED directly at too much current
safety:
  - Always limit current with a resistor or driver stage
boards: [arduino-uno]
related_components: [arduino-uno, ir-receiver]
source_book: Arduino-book-master
---

An IR LED emits invisible infrared light and is commonly used to send remote control codes.
