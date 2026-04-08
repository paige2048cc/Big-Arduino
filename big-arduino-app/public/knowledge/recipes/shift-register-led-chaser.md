---
id: shift-register-led-chaser
name: Shift Register LED Chaser
aliases: [74hc595 leds, shift register leds]
category: logic-project
boards: [arduino-uno]
related_components: [arduino-uno, shift-register-74hc595, led-5mm, Registor_220Ω]
concepts: [shift-registers]
difficulty: medium
intent: control multiple LEDs through a 74HC595
source_book: Arduino-book-master
source_files:
  - 5.3.12-74HC595.ino
---

Clock bytes into the `74HC595`, then toggle the latch pin to update several LEDs with only a few Arduino pins.
