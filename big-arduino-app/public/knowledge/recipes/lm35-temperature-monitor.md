---
id: lm35-temperature-monitor
name: LM35 Temperature Monitor
aliases: [lm35 serial, temperature monitor]
category: sensor-project
boards: [arduino-uno]
related_components: [arduino-uno, lm35]
concepts: [analog-input, temperature-sensing, serial-basics]
difficulty: easy
intent: read LM35 temperature and print it to serial
source_book: Arduino-book-master
source_files:
  - 2.5.4-lm35.ino
---

```cpp
const int lm35Pin = A0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(lm35Pin);
  float voltage = reading * (5.0 / 1023.0);
  float temperatureC = voltage * 100.0;
  Serial.println(temperatureC);
  delay(500);
}
```
