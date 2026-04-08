---
id: analog-input
name: Analog Input
aliases: [analog read, adc, variable voltage input]
category: programming
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno, potentiometer, photoresistor, lm35]
common_issues:
  - Wiring the sensor to a digital pin instead of an analog pin
  - Forgetting to provide a reference ground
  - Expecting the reading to be stable without a proper voltage divider
safety:
  - Keep sensor voltages within the board input range
source_book: Arduino-book-master, 101-book-master
source_files:
  - 2.5.3-AnalogRead.ino
  - 2.6.3-analogread.ino
---

`analogRead()` converts a voltage on an analog pin into a value, typically `0-1023` on Arduino UNO. It is used for sensors and variable inputs such as potentiometers and light sensors.
