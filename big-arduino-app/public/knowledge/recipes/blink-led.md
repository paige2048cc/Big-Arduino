---
id: blink-led
name: Blink an LED
aliases: [blink, led blink, flashing led, blinking light]
category: starter-project
boards: [arduino-uno, arduino-101]
related_components:
  - arduino-uno
  - led-5mm
  - resistor-220
concepts:
  - digital-output
difficulty: easy
intent: beginner output example and first code block
common_issues:
  - LED polarity is reversed
  - The LED is connected without a series resistor
  - Code pin number does not match the wiring
safety:
  - Use a current-limiting resistor with the LED
sources:
  - Arduino-book-master/1.6-Blink.ino
  - 101-book-master/2.5.1-blink.ino
source_book: Arduino-book-master, 101-book-master
source_files:
  - 1.6-Blink.ino
  - 2.5.1-blink.ino
---

## Use when

The user wants the simplest working Arduino code example, or they have an Arduino, LED, and resistor and want to confirm the basics.

## Wiring

- Arduino digital pin -> 220 ohm resistor -> LED anode
- LED cathode -> GND

Recommended pins:

- `D13` if using the built-in LED
- any digital pin for an external LED

## Code template

```cpp
const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  delay(1000);
  digitalWrite(ledPin, LOW);
  delay(1000);
}
```

## Adaptation rules

- If the LED is wired to a different pin, replace `13` with the actual connected digital pin
- If the user placed an external LED, remind them to keep the resistor in series
