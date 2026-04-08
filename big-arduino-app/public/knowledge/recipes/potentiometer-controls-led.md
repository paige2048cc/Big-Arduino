---
id: potentiometer-controls-led
name: Potentiometer Controls LED Brightness
aliases: [pot led, analog input led, dimmer]
category: starter-project
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno, potentiometer, led-5mm, Registor_220Ω]
concepts: [analog-input, pwm-output]
difficulty: easy
intent: generate code that reads a potentiometer and controls LED brightness
source_book: Arduino-book-master, 101-book-master
source_files:
  - 2.5.3-AnalogRead2.ino
  - 2.6.2-analogwrite2.ino
---

```cpp
const int potPin = A0;
const int ledPin = 9;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  int sensor = analogRead(potPin);
  int brightness = map(sensor, 0, 1023, 0, 255);
  analogWrite(ledPin, brightness);
}
```
