---
id: serial-basics
name: Serial Basics
aliases: [serial monitor, serial print, serial read, uart basics]
category: communication
boards: [arduino-uno, arduino-101]
related_components:
  - arduino-uno
concepts:
  - serial
  - serialprint
  - serialread
common_issues:
  - Baud rate mismatch between code and Serial Monitor
  - Forgetting Serial.begin()
  - Reusing D0 and D1 for other wiring while debugging over USB serial
safety:
  - Avoid driving external circuits on D0 and D1 while using USB serial
sources:
  - Arduino-book-master/2.6.1-SerialOut.ino
  - Arduino-book-master/2.6.2-SerialIn.ino
  - 101-book-master/2.8.1-serialprint.ino
  - 101-book-master/2.8.2-serialread.ino
source_book: Arduino-book-master, 101-book-master
source_files:
  - 2.6.1-SerialOut.ino
  - 2.6.2-SerialIn.ino
  - 2.8.1-serialprint.ino
  - 2.8.2-serialread.ino
---

## What it means

Serial communication lets the Arduino exchange text data with a computer through USB. It is the fastest way to inspect sensor values, user input, and debug program flow.

## Minimal output pattern

```cpp
void setup() {
  Serial.begin(9600);
}

void loop() {
  Serial.println("Hello");
  delay(1000);
}
```

## Minimal input pattern

```cpp
void setup() {
  Serial.begin(9600);
}

void loop() {
  if (Serial.available() > 0) {
    char incoming = Serial.read();
    Serial.println(incoming);
  }
}
```

## Important UNO note

Pins `D0` and `D1` are shared with hardware serial. If the user is actively using the Serial Monitor, avoid recommending those pins for LEDs, buttons, or sensors unless there is a clear reason.
