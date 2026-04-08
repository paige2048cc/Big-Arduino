---
id: ir-receiver
name: IR Receiver
aliases: [infrared receiver, ir recv]
category: sensors
pins:
  - name: OUT
    function: Digital signal output
    notes: Connect to a digital input pin
  - name: GND
    function: Ground
    notes: Common reference
  - name: VCC
    function: Power input
    notes: Module supply
common_issues:
  - Using the wrong decode library or protocol
  - Wiring the output to the wrong pin type
safety:
  - Confirm module voltage compatibility
boards: [arduino-uno]
related_components: [arduino-uno, ir-led]
source_book: Arduino-book-master
---

IR receivers decode bursts from remote controls and expose them as digital timing pulses that libraries can interpret.
