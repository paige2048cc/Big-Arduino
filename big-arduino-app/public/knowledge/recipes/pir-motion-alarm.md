---
id: pir-motion-alarm
name: PIR Motion Alarm
aliases: [pir buzzer, motion detector]
category: sensor-project
boards: [arduino-uno]
related_components: [arduino-uno, pir-sensor, buzzer]
concepts: [digital-output]
difficulty: easy
intent: generate code for a motion-triggered alert
source_book: Arduino-book-master
source_files:
  - 2.5.2-PIRAndLamp.ino
---

```cpp
const int pirPin = 2;
const int buzzerPin = 8;

void setup() {
  pinMode(pirPin, INPUT);
  pinMode(buzzerPin, OUTPUT);
}

void loop() {
  bool motion = digitalRead(pirPin) == HIGH;
  digitalWrite(buzzerPin, motion ? HIGH : LOW);
}
```
