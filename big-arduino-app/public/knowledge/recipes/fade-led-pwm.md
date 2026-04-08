---
id: fade-led-pwm
name: Fade LED with PWM
aliases: [fade led, breathing led, pwm led, analogwrite led]
category: starter-project
boards: [arduino-uno, arduino-101]
related_components:
  - arduino-uno
  - led-5mm
  - resistor-220
concepts:
  - pwm-output
difficulty: easy
intent: generate analogWrite example for LED brightness control
common_issues:
  - Choosing a non-PWM pin on UNO
  - Expecting analogRead style values from analogWrite
  - Omitting the LED resistor
safety:
  - Keep a resistor in series with the LED
sources:
  - Arduino-book-master/2.5.3-Fading.ino
  - 101-book-master/2.6.2-analogwrite.ino
source_book: Arduino-book-master, 101-book-master
source_files:
  - 2.5.3-Fading.ino
  - 2.6.2-analogwrite.ino
---

## Use when

The user wants to control LED brightness or create a breathing light effect.

## Wiring

- PWM-capable digital pin -> resistor -> LED anode
- LED cathode -> GND

On Arduino UNO, use `D3`, `D5`, `D6`, `D9`, `D10`, or `D11`.

## Code template

```cpp
const int ledPin = 9;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  for (int brightness = 0; brightness <= 255; brightness++) {
    analogWrite(ledPin, brightness);
    delay(8);
  }

  for (int brightness = 255; brightness >= 0; brightness--) {
    analogWrite(ledPin, brightness);
    delay(8);
  }
}
```

## Adaptation rules

- If the connected LED pin is not PWM-capable, suggest rewiring to a PWM pin before generating code
