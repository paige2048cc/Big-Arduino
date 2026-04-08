---
id: serial-control-led
name: Serial Control LED
aliases: [serial led, led over serial, serial command led, monitor control]
category: starter-project
boards: [arduino-uno, arduino-101]
related_components:
  - arduino-uno
  - led-5mm
  - resistor-220
concepts:
  - serial-basics
  - digital-output
difficulty: medium
intent: generate code that uses Serial Monitor commands to control an LED
common_issues:
  - Forgetting Serial.begin(9600)
  - Using a different baud rate in code and Serial Monitor
  - Trying to use D0 and D1 for the LED while also using serial over USB
safety:
  - Use a resistor with the LED
sources:
  - Arduino-book-master/2.6.2-SerialIn.ino
  - 101-book-master/2.8.2-serialread.ino
source_book: Arduino-book-master, 101-book-master
source_files:
  - 2.6.2-SerialIn.ino
  - 2.8.2-serialread.ino
---

## Use when

The user wants to type commands in the Serial Monitor and turn an LED on or off from the computer.

## Wiring

- Digital output pin -> resistor -> LED anode
- LED cathode -> GND

Avoid using `D0` or `D1` for the LED in this project.

## Code template

```cpp
const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    char command = Serial.read();

    if (command == '1') {
      digitalWrite(ledPin, HIGH);
      Serial.println("LED ON");
    } else if (command == '0') {
      digitalWrite(ledPin, LOW);
      Serial.println("LED OFF");
    }
  }
}
```

## Adaptation rules

- Keep the LED on a regular digital output such as `D13`
- Tell the user to open Serial Monitor and send `1` or `0`
