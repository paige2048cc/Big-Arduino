---
id: pwm-output
name: PWM Output
aliases: [analog write, pwm, pulse width modulation, fade led]
category: programming
boards: [arduino-uno, arduino-101]
related_components:
  - arduino-uno
  - led-5mm
  - buzzer
concepts:
  - analogwrite
  - pwm
common_issues:
  - Using analogWrite() on a pin that does not support PWM
  - Expecting analogWrite() to output a true analog voltage
  - Forgetting that LEDs still need a resistor
safety:
  - Use a resistor when driving LEDs from PWM pins
sources:
  - Arduino-book-master/2.5.3-Fading.ino
  - 101-book-master/2.6.2-analogwrite.ino
source_book: Arduino-book-master, 101-book-master
source_files:
  - 2.5.3-Fading.ino
  - 2.6.2-analogwrite.ino
---

## What it means

PWM stands for Pulse Width Modulation. On Arduino UNO, `analogWrite()` rapidly switches a digital pin on and off to create an average output level.

For LEDs, this looks like adjustable brightness.

## Minimal pattern

```cpp
const int ledPin = 9;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  analogWrite(ledPin, 128);
}
```

## UNO PWM pins

On Arduino UNO, PWM is available on:

- `D3`
- `D5`
- `D6`
- `D9`
- `D10`
- `D11`

## Typical values

- `0` means always off
- `255` means fully on
- values in between change average power
