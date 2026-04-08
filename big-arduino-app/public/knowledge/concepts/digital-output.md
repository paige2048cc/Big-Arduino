---
id: digital-output
name: Digital Output
aliases: [digital write, pin output, output mode, led output]
category: programming
boards: [arduino-uno, arduino-101]
related_components:
  - arduino-uno
  - led-5mm
  - buzzer
concepts:
  - pinmode
  - digitalwrite
common_issues:
  - Forgetting to call pinMode(pin, OUTPUT) in setup()
  - Driving a load directly that needs more current than an Arduino pin can supply
  - Using the wrong pin number compared with the wiring
safety:
  - Keep Arduino I/O current within safe limits
  - Use a resistor with LEDs
sources:
  - Arduino-book-master/1.6-Blink.ino
  - 101-book-master/2.5.1-blink.ino
source_book: Arduino-book-master, 101-book-master
source_files:
  - 1.6-Blink.ino
  - 2.5.1-blink.ino
---

## What it means

Digital output lets an Arduino pin drive two logic levels:

- `HIGH` outputs approximately 5V on UNO
- `LOW` outputs approximately 0V

This is the foundation for turning LEDs, buzzers, relays, and other simple actuators on and off.

## Minimal pattern

```cpp
const int outputPin = 13;

void setup() {
  pinMode(outputPin, OUTPUT);
}

void loop() {
  digitalWrite(outputPin, HIGH);
  delay(1000);
  digitalWrite(outputPin, LOW);
  delay(1000);
}
```

## When to use it

- Blink an LED
- Turn a buzzer on or off
- Send a control signal to a transistor or module input

## Design notes

- `pinMode()` sets the pin direction once in `setup()`
- `digitalWrite()` changes the level many times in `loop()`
- If the component needs more current, drive it through a transistor instead of directly from the pin
