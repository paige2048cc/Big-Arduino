---
id: rgb-led-common-cathode
name: RGB LED (Common Cathode)
aliases: [rgb led, common cathode rgb led]
category: passive
pins:
  - name: R
    function: Red channel input
    notes: Usually driven through a resistor
  - name: G
    function: Green channel input
    notes: Usually driven through a resistor
  - name: B
    function: Blue channel input
    notes: Usually driven through a resistor
  - name: CATHODE
    function: Shared ground
    notes: Connect to GND
common_issues:
  - Forgetting a resistor on each color channel
  - Confusing common cathode with common anode wiring
safety:
  - Use current-limiting resistors on all channels
boards: [arduino-uno]
related_components: [arduino-uno]
source_book: Arduino-book-master
---

An RGB LED combines red, green, and blue light in one package so Arduino projects can mix many visible colors.
