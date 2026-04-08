---
id: distance-sensing
name: Ultrasonic Distance Sensing
aliases: [distance sensor, ultrasonic sensor, sr04]
category: sensing
boards: [arduino-uno, arduino-101]
related_components: [ultrasonic-sr04]
common_issues:
  - Swapping TRIG and ECHO pins
  - Forgetting a ground connection
  - Expecting stable readings from soft or angled surfaces
safety:
  - Do not power the module with a higher voltage than specified
source_book: Arduino-book-master, 101-book-master
source_files:
  - 3.3.1-Sr04.ino
  - 3.2.1-sr04.ino
---

Ultrasonic sensors measure distance by sending a pulse from `TRIG` and timing the echo pulse returned on `ECHO`.
