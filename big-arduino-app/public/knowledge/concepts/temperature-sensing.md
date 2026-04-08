---
id: temperature-sensing
name: Temperature Sensing
aliases: [temperature sensor, lm35, dht11 temperature]
category: sensing
boards: [arduino-uno, arduino-101]
related_components: [lm35, dht11]
common_issues:
  - Mixing analog temperature sensors with digital sensor code
  - Using the wrong conversion formula
  - Forgetting that DHT11 updates slowly
safety:
  - Verify operating voltage before wiring sensors
source_book: Arduino-book-master
source_files:
  - 2.5.4-lm35.ino
  - 6.2.2-DHT11.ino
---

Temperature sensors may output either an analog voltage, like `LM35`, or a digital data stream, like `DHT11`. The code and wiring must match the sensor type.
