---
id: rgb-led-color-cycle
name: RGB LED Color Cycle
aliases: [rgb led fade, color cycle]
category: starter-project
boards: [arduino-uno]
related_components: [arduino-uno, rgb-led-common-cathode, Registor_220Ω]
concepts: [pwm-output]
difficulty: medium
intent: generate PWM code for an RGB LED
source_book: Arduino-book-master
source_files:
  - 5.1.6-SerialRGBLED.ino
---

```cpp
const int redPin = 9;
const int greenPin = 10;
const int bluePin = 11;

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
}

void loop() {
  analogWrite(redPin, 255); analogWrite(greenPin, 0); analogWrite(bluePin, 0); delay(500);
  analogWrite(redPin, 0); analogWrite(greenPin, 255); analogWrite(bluePin, 0); delay(500);
  analogWrite(redPin, 0); analogWrite(greenPin, 0); analogWrite(bluePin, 255); delay(500);
}
```
