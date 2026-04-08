---
id: photoresistor-night-light
name: Photoresistor Night Light
aliases: [light sensor led, ldr led]
category: starter-project
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno, photoresistor, led-5mm, Registor_220Ω]
concepts: [analog-input]
difficulty: easy
intent: generate code for a light-reactive LED
source_book: Arduino-book-master
source_files:
  - 2.5.3-AnalogRead.ino
---

```cpp
const int lightPin = A0;
const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  int value = analogRead(lightPin);
  digitalWrite(ledPin, value < 400 ? HIGH : LOW);
  delay(50);
}
```
