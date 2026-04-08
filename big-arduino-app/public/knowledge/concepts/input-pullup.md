---
id: input-pullup
name: Digital Input with INPUT_PULLUP
aliases: [button input, pullup resistor, internal pullup, digital input]
category: programming
boards: [arduino-uno, arduino-101]
related_components:
  - arduino-uno
  - pushbutton
concepts:
  - pinmode
  - digitalread
  - input_pullup
common_issues:
  - Expecting HIGH when the button is pressed while using INPUT_PULLUP
  - Wiring both button connections to the same side of the switch
  - Leaving a digital input floating without pull-up or pull-down
safety:
  - Disconnect power before reworking button wiring
sources:
  - Arduino-book-master/2.5.1-ButtonAndLED.ino
  - 101-book-master/2.5.3-buttonLed.ino
source_book: Arduino-book-master, 101-book-master
source_files:
  - 2.5.1-ButtonAndLED.ino
  - 2.5.3-buttonLed.ino
---

## What it means

`INPUT_PULLUP` enables the Arduino's internal pull-up resistor, so the input reads:

- `HIGH` when the button is not pressed
- `LOW` when the button is pressed and connected to ground

This avoids floating inputs and reduces external parts.

## Minimal pattern

```cpp
const int buttonPin = 2;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
}

void loop() {
  bool pressed = digitalRead(buttonPin) == LOW;
}
```

## Why beginners get confused

With `INPUT_PULLUP`, the button logic is inverted:

- pressed -> `LOW`
- released -> `HIGH`

So code often needs `digitalRead(pin) == LOW` to detect a press.

## Wiring rule

One side of the button goes to the input pin, and the opposite side goes to `GND`.
