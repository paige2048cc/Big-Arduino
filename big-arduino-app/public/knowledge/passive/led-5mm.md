---
id: led-5mm
name: LED (5mm)
aliases: [light emitting diode, indicator LED, 5mm LED]
category: passive

pins:
  - name: ANODE
    function: Positive terminal
    notes: Longer leg on physical LED. Connect to power through resistor.
  - name: CATHODE
    function: Negative terminal
    notes: Shorter leg. Flat side of LED case. Connect to ground.

common_issues:
  - LED not lighting up (wrong polarity)
  - LED burned out (no current-limiting resistor)
  - Dim LED (resistor value too high)

safety:
  - Always use a current-limiting resistor (220-1k ohm for 5V)
  - Do not exceed maximum forward current (typically 20mA)
  - Reverse voltage can damage the LED

sources:
  - https://docs.wokwi.com/parts/wokwi-led
  - https://learn.sparkfun.com/tutorials/light-emitting-diodes-leds
  - https://docs.arduino.cc/built-in-examples/basics/Blink
---

## What it is

An LED (Light Emitting Diode) is a semiconductor device that emits light when current flows through it. Unlike incandescent bulbs, LEDs are efficient, long-lasting, and available in many colors.

The 5mm LED is the most common size for hobbyist projects and is ideal for indicators and simple displays.

## Pins

| Pin | Label | Description |
|-----|-------|-------------|
| ANODE | + | Positive terminal. The longer leg on a physical LED. Current flows IN here. |
| CATHODE | - | Negative terminal. The shorter leg / flat side. Current flows OUT to ground. |

**Tip**: Remember "ACID" - Anode Current In, Diode (cathode) current out.

## How to use

### Basic connection
1. Connect the ANODE to a digital pin through a 220 ohm resistor
2. Connect the CATHODE to GND
3. Set the digital pin HIGH to turn on, LOW to turn off

### Arduino code example
```cpp
const int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);  // Turn on
  delay(1000);
  digitalWrite(ledPin, LOW);   // Turn off
  delay(1000);
}
```

### Why use a resistor?

LEDs have very low resistance. Without a resistor, too much current flows and the LED burns out. The resistor limits current to a safe level (typically 10-20mA).

**Resistor calculation**: R = (V_supply - V_forward) / I_desired
- For a red LED with 5V supply: R = (5V - 2V) / 0.02A = 150 ohm (use 220 ohm for safety margin)

## Common mistakes

### 1. LED connected backwards
**Symptom**: LED doesn't light up, but circuit seems correct.
**Solution**: Swap the ANODE and CATHODE connections. Remember the longer leg goes to positive.

### 2. No current-limiting resistor
**Symptom**: LED lights very brightly then goes dark permanently.
**Solution**: Always use a resistor (220 ohm is a safe default for 5V circuits).

### 3. Resistor in wrong location
**Symptom**: LED doesn't light or behaves strangely.
**Solution**: The resistor can be on either the ANODE or CATHODE side - just ensure it's in series with the LED, not parallel.

## Troubleshooting

| Problem | Check | Solution |
|---------|-------|----------|
| LED not lighting | Polarity | Flip the LED orientation |
| LED not lighting | Resistor | Ensure resistor is connected in series |
| LED not lighting | Pin mode | Verify `pinMode(pin, OUTPUT)` is called |
| LED dim | Resistor value | Try a lower resistance (but not below 150 ohm) |
| LED flickering | Loose connection | Check all wire connections |
| LED burned out | No resistor | Replace LED and add 220 ohm resistor |
