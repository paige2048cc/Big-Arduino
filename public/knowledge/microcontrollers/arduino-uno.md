---
id: arduino-uno
name: Arduino UNO R3
aliases: [Arduino, UNO, Arduino board, microcontroller]
category: microcontrollers

pins:
  - name: D0-D13
    function: Digital I/O pins
    notes: Can be used as input or output. D3, D5, D6, D9, D10, D11 support PWM.
  - name: A0-A5
    function: Analog input pins
    notes: 10-bit ADC, reads 0-1023. Can also be used as digital pins.
  - name: 5V
    function: 5V power output
    notes: Regulated 5V supply, max ~500mA
  - name: 3.3V
    function: 3.3V power output
    notes: Regulated 3.3V supply, max 50mA
  - name: GND
    function: Ground
    notes: Common ground for all circuits
  - name: VIN
    function: Voltage input
    notes: External power input (7-12V recommended)

common_issues:
  - Wrong pin mode set (INPUT vs OUTPUT)
  - Exceeding pin current limits (40mA max per pin)
  - Forgetting to set pinMode()
  - Using wrong pin numbers in code

safety:
  - Do not exceed 40mA per I/O pin
  - Do not exceed 5V on any pin (can damage the board)
  - Use current-limiting resistors with LEDs
  - Disconnect power before changing wiring

sources:
  - https://docs.wokwi.com/parts/wokwi-arduino-uno
  - https://docs.arduino.cc/hardware/uno-rev3
  - https://www.arduino.cc/en/Tutorial/Foundations
---

## What it is

The Arduino UNO R3 is a microcontroller board based on the ATmega328P. It's the most popular Arduino board for beginners and prototyping. It has 14 digital I/O pins, 6 analog inputs, USB connection, and can be powered via USB or external supply.

## Pins

### Digital Pins (D0-D13)

| Pin | Special Functions |
|-----|-------------------|
| D0 | RX (Serial receive) |
| D1 | TX (Serial transmit) |
| D2 | External interrupt 0 |
| D3 | PWM, External interrupt 1 |
| D4 | - |
| D5 | PWM |
| D6 | PWM |
| D7 | - |
| D8 | - |
| D9 | PWM |
| D10 | PWM, SPI SS |
| D11 | PWM, SPI MOSI |
| D12 | SPI MISO |
| D13 | SPI SCK, Built-in LED |

**PWM pins** (marked with ~): D3, D5, D6, D9, D10, D11 - can output analog-like signals using `analogWrite()`.

### Analog Pins (A0-A5)

| Pin | Special Functions |
|-----|-------------------|
| A0-A3 | Analog input only |
| A4 | Analog input, I2C SDA |
| A5 | Analog input, I2C SCL |

Analog pins can also be used as digital pins (D14-D19).

### Power Pins

| Pin | Description |
|-----|-------------|
| 5V | Regulated 5V output (from USB or regulator) |
| 3.3V | Regulated 3.3V output (50mA max) |
| GND | Ground (3 pins available) |
| VIN | External power input (7-12V) |

## How to use

### Basic digital output (LED)
```cpp
const int ledPin = 13;  // Built-in LED

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

### Basic digital input (Button)
```cpp
const int buttonPin = 2;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
}

void loop() {
  if (digitalRead(buttonPin) == LOW) {
    // Button is pressed
  }
}
```

### Analog input
```cpp
const int sensorPin = A0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int value = analogRead(sensorPin);  // Returns 0-1023
  Serial.println(value);
  delay(100);
}
```

### PWM output (LED brightness)
```cpp
const int ledPin = 9;  // Must be a PWM pin

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  for (int i = 0; i <= 255; i++) {
    analogWrite(ledPin, i);  // 0-255 brightness
    delay(10);
  }
}
```

## Common mistakes

### 1. Forgetting pinMode()
**Symptom**: Pin doesn't work as expected.
**Solution**: Always call `pinMode(pin, INPUT)` or `pinMode(pin, OUTPUT)` in `setup()`.

### 2. Using D0/D1 while using Serial
**Symptom**: Serial communication fails or behaves erratically.
**Solution**: D0 and D1 are used for Serial communication. Avoid using them for other purposes when using `Serial.print()`.

### 3. Exceeding current limits
**Symptom**: Arduino resets, gets hot, or pins stop working.
**Solution**: Each pin can source/sink max 40mA. Use transistors for higher current loads.

### 4. Wrong pin number
**Symptom**: Code doesn't control the expected component.
**Solution**: Double-check pin numbers match between code and wiring.

## Troubleshooting

| Problem | Check | Solution |
|---------|-------|----------|
| LED not lighting | Pin mode | Ensure `pinMode(pin, OUTPUT)` is called |
| Button not responding | Pull resistor | Use `INPUT_PULLUP` or add external resistor |
| Analog reads always 0 or 1023 | Wiring | Check sensor is properly connected |
| Serial not working | Baud rate | Ensure Serial Monitor baud rate matches code |
| Board not recognized | USB cable | Try different cable (some are charge-only) |
| Upload fails | Port selection | Select correct COM port in Arduino IDE |

## On-board LEDs

| LED | Purpose |
|-----|---------|
| L | Connected to pin 13, user-controllable |
| TX | Blinks when transmitting serial data |
| RX | Blinks when receiving serial data |
| ON | Power indicator |
