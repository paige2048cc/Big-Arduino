---
id: infrared-basics
name: Infrared Basics
aliases: [ir, infrared remote, remote control]
category: communication
boards: [arduino-uno]
related_components: [ir-receiver, ir-led]
common_issues:
  - Using the wrong library or protocol
  - Forgetting a current-limiting resistor on the IR LED
  - Expecting direct line-of-sight hardware to work through obstacles
safety:
  - Use a resistor with the IR LED
source_book: Arduino-book-master
source_files:
  - 7.2-Irrecv.ino
  - 7.3-Irsend.ino
---

Infrared communication uses a transmitter LED and a receiver module to send modulated control pulses, often for remote control projects.
