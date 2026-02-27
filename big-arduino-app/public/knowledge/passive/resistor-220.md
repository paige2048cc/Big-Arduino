---
id: resistor-220
name: Resistor (220 ohm)
aliases: [resistor, 220 ohm resistor, current limiting resistor]
category: passive

pins:
  - name: TERM1
    function: Terminal 1
    notes: Non-polarized - can connect either way
  - name: TERM2
    function: Terminal 2
    notes: Non-polarized - can connect either way

common_issues:
  - Wrong resistance value selected
  - Resistor not in series with component
  - Resistor placed in parallel instead of series

safety:
  - Standard resistors can handle typical Arduino currents
  - Check power rating for high-current applications
  - Resistors may get warm under load - this is normal

sources:
  - https://docs.wokwi.com/parts/wokwi-resistor
  - https://learn.sparkfun.com/tutorials/resistors
  - https://docs.arduino.cc/learn/electronics/resistors
---

## What it is

A resistor is a passive electrical component that limits the flow of electric current. It's measured in ohms. The 220 ohm resistor is commonly used as a current-limiting resistor for LEDs with 5V power supplies.

Resistors are **non-polarized** - they work the same regardless of which direction current flows through them.

## Pins

| Pin | Description |
|-----|-------------|
| TERM1 | Terminal 1 (either end) |
| TERM2 | Terminal 2 (either end) |

**Non-polarized**: Unlike LEDs, resistors have no positive or negative side. You can connect them in either direction.

## How to use

### Current limiting for LEDs
Place the resistor in series with the LED to limit current and prevent burnout.

```
Arduino Pin → Resistor → LED Anode → LED Cathode → GND
```

OR

```
Arduino Pin → LED Anode → LED Cathode → Resistor → GND
```

Both configurations work equally well.

### Pull-down resistor for buttons
Connect between the input pin and GND to ensure a stable LOW when button is not pressed.

```
Button → Arduino Pin
           ↓
      10k Resistor → GND
```

### Calculating resistor value

**For LEDs**: R = (V_supply - V_forward) / I_desired

| LED Color | V_forward | Resistor for 20mA @ 5V |
|-----------|-----------|------------------------|
| Red | 2.0V | 150 ohm |
| Yellow | 2.1V | 145 ohm |
| Green | 2.2V | 140 ohm |
| Blue | 3.3V | 85 ohm |
| White | 3.3V | 85 ohm |

**220 ohm is a safe default** for most LEDs at 5V - it limits current to about 13-15mA, which is bright enough while being safe.

## Common mistakes

### 1. Resistor in parallel instead of series
**Symptom**: LED burns out or is too bright.
**Solution**: The resistor must be in the same current path as the LED (series), not connected across it (parallel).

### 2. Wrong resistance value
**Symptom**: LED too dim (resistance too high) or LED burns out (resistance too low).
**Solution**: Use the formula R = (V_supply - V_forward) / I_desired. For 5V with a red LED, 150-330 ohm is typical.

### 3. Forgetting the resistor entirely
**Symptom**: LED lights very brightly then stops working.
**Solution**: Always use a current-limiting resistor with LEDs.

## Troubleshooting

| Problem | Check | Solution |
|---------|-------|----------|
| LED too dim | Resistance value | Use a lower value resistor (but not below safe limit) |
| LED burned out | Resistor present? | Add resistor if missing; check if in series |
| Resistor getting hot | Current draw | May need higher power rating or higher resistance |
| Circuit not working | Connections | Ensure resistor is properly connected in series |

## Resistor color codes

The colored bands on a resistor indicate its value:

**220 ohm**: Red - Red - Brown - Gold
- Red (2) - Red (2) - Brown (x10) - Gold (5% tolerance)
- = 22 x 10 = 220 ohm

**Common values**:
- 100 ohm: Brown - Black - Brown
- 220 ohm: Red - Red - Brown
- 330 ohm: Orange - Orange - Brown
- 1k ohm: Brown - Black - Red
- 10k ohm: Brown - Black - Orange
