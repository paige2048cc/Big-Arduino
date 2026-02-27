---
id: pushbutton
name: Pushbutton
aliases: [push button, tactile switch, momentary switch, button]
category: passive

pins:
  - name: PIN1A
    function: Contact 1 (left)
    notes: Internally connected to PIN1B
  - name: PIN1B
    function: Contact 1 (right)
    notes: Internally connected to PIN1A
  - name: PIN2A
    function: Contact 2 (left)
    notes: Internally connected to PIN2B
  - name: PIN2B
    function: Contact 2 (right)
    notes: Internally connected to PIN2A

common_issues:
  - Button always reads HIGH or LOW (incorrect wiring)
  - Button press not detected (missing pull-up/pull-down resistor)
  - Multiple triggers per press (bouncing)

safety:
  - Pushbuttons are low-power components, no special safety concerns
  - Ensure proper debouncing in code to avoid erratic behavior

sources:
  - https://docs.wokwi.com/parts/wokwi-pushbutton
  - https://docs.arduino.cc/built-in-examples/digital/Button
  - https://learn.sparkfun.com/tutorials/switch-basics
---

## What it is

A pushbutton (also called tactile switch or momentary switch) is a simple mechanical switch that connects two contacts when pressed. When released, the contacts disconnect.

The 4-pin pushbutton has two pairs of internally connected pins. When pressed, all four pins connect together, completing the circuit.

## Pins

| Pin | Position | Internal Connection |
|-----|----------|---------------------|
| PIN1A | Top-left | Connected to PIN1B |
| PIN1B | Top-right | Connected to PIN1A |
| PIN2A | Bottom-left | Connected to PIN2B |
| PIN2B | Bottom-right | Connected to PIN2A |

**When pressed**: PIN1A/PIN1B connect to PIN2A/PIN2B (all 4 pins connected)

**When released**: PIN1A/PIN1B are isolated from PIN2A/PIN2B

## How to use

### Basic connection with internal pull-up
1. Connect one side (PIN1A or PIN1B) to a digital pin
2. Connect the other side (PIN2A or PIN2B) to GND
3. Use `INPUT_PULLUP` mode - button reads LOW when pressed

### Arduino code example
```cpp
const int buttonPin = 2;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);  // Enable internal pull-up resistor
  Serial.begin(9600);
}

void loop() {
  int buttonState = digitalRead(buttonPin);

  if (buttonState == LOW) {  // Button is pressed (pulled to ground)
    Serial.println("Button pressed!");
  }
  delay(50);  // Simple debounce
}
```

### Why use INPUT_PULLUP?

Without a pull-up or pull-down resistor, the pin "floats" when the button is not pressed, giving random readings. `INPUT_PULLUP` enables the Arduino's internal pull-up resistor, ensuring the pin reads HIGH when the button is open.

## Common mistakes

### 1. Floating input pin
**Symptom**: Button readings are erratic or random.
**Solution**: Use `INPUT_PULLUP` mode or add an external 10k ohm pull-up/pull-down resistor.

### 2. Wrong pins connected
**Symptom**: Button always reads the same value (pressed or not pressed).
**Solution**: Connect pins from opposite sides (e.g., PIN1A to Arduino, PIN2A to GND). Pins on the same side are already connected internally.

### 3. No debouncing
**Symptom**: Single button press triggers multiple actions.
**Solution**: Add a small delay (10-50ms) after detecting a press, or use proper debounce code.

## Troubleshooting

| Problem | Check | Solution |
|---------|-------|----------|
| Always reads HIGH | Wiring | Ensure button connects pin to GND when pressed |
| Always reads LOW | Wiring | Check if pins are on opposite sides of button |
| Erratic readings | Pull resistor | Use INPUT_PULLUP or add external pull resistor |
| Multiple triggers | Bouncing | Add debounce delay or use debounce library |
| Button unresponsive | Pin mode | Verify pinMode() is set correctly |

## Button bouncing

When a mechanical button is pressed or released, the contacts can "bounce" - rapidly connecting and disconnecting for a few milliseconds. This can cause a single press to register multiple times.

**Simple debounce**: Add a 10-50ms delay after detecting a state change.

**Better debounce**: Track the last stable state and only register changes that persist for a minimum time.
