---
id: button-controls-led
name: Button Controls LED
aliases: [button led, press button led, button switch led, input output example]
category: starter-project
boards: [arduino-uno, arduino-101]
related_components:
  - arduino-uno
  - pushbutton
  - led-5mm
  - resistor-220
concepts:
  - input-pullup
  - digital-output
difficulty: easy
intent: generate code for button input controlling an LED
common_issues:
  - Using INPUT instead of INPUT_PULLUP and leaving the input floating
  - Forgetting that pressed state becomes LOW with INPUT_PULLUP
  - Wiring both button leads to the same internal side of the switch
safety:
  - Keep the LED in series with a resistor
sources:
  - Arduino-book-master/2.5.1-ButtonAndLED.ino
  - 101-book-master/2.5.3-buttonLed.ino
source_book: Arduino-book-master, 101-book-master
source_files:
  - 2.5.1-ButtonAndLED.ino
  - 2.5.3-buttonLed.ino
---

## Use when

The user asks for a beginner interactive project where pressing a button changes an LED state.

## Wiring

- LED: digital output pin -> resistor -> LED anode, LED cathode -> GND
- Button: one side -> digital input pin, opposite side -> GND
- In code, configure the button pin as `INPUT_PULLUP`

## Code template

```cpp
const int buttonPin = 2;
const int ledPin = 13;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
}

void loop() {
  bool pressed = digitalRead(buttonPin) == LOW;
  digitalWrite(ledPin, pressed ? HIGH : LOW);
}
```

## Adaptation rules

- Replace `buttonPin` and `ledPin` with the actual connected pins
- If the user wants toggle behavior instead of hold-to-light, add state tracking and debounce logic
