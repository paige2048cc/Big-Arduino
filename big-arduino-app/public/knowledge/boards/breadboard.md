---
id: breadboard
name: Breadboard (Half-Size)
aliases: [breadboard, solderless breadboard, protoboard]
category: boards

pins:
  - name: Power Rails
    function: Horizontal power distribution
    notes: Top and bottom rows marked + and - for power and ground
  - name: Terminal Strips
    function: Vertical connection groups
    notes: 5 holes per group, rows A-E and F-J are separate sections

common_issues:
  - Components on wrong rows (not connected)
  - Bridging the center gap incorrectly
  - Power rails not connected to power source
  - Confusing internal connections

safety:
  - Do not exceed voltage/current ratings
  - Avoid inserting wires that are too thick (damages holes)
  - Keep breadboard clean and dry

sources:
  - https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard
  - https://learn.adafruit.com/breadboards-for-beginners
---

## What it is

A breadboard (solderless breadboard) is a reusable platform for building electronic circuits without soldering. Components and wires are inserted into holes that are internally connected in specific patterns, allowing quick prototyping and easy modifications.

## Internal connections

### Power Rails (Top and Bottom)
```
+ + + + + + + + + + + + + + + + + + + + + + + + +  ← All connected horizontally
- - - - - - - - - - - - - - - - - - - - - - - - -  ← All connected horizontally
```
- The **+** row (red line) is typically connected to power (5V or 3.3V)
- The **-** row (blue line) is typically connected to ground (GND)
- All holes in the same rail row are connected together

### Terminal Strips (Main Area)
```
  1   2   3   4   5   ...
A o   o   o   o   o       ┐
B o   o   o   o   o       │ Connected vertically
C o   o   o   o   o       │ (5 holes per column)
D o   o   o   o   o       │
E o   o   o   o   o       ┘
  ─ ─ ─ CENTER GAP ─ ─ ─     ← NOT connected across
F o   o   o   o   o       ┐
G o   o   o   o   o       │ Connected vertically
H o   o   o   o   o       │ (5 holes per column)
I o   o   o   o   o       │
J o   o   o   o   o       ┘
```

**Key points**:
- Holes in the same **column** (A-E or F-J) are connected
- The **center gap** separates the two halves - no connection across it
- Each column has 5 connected holes

## How to use

### Basic LED circuit
1. Connect Arduino 5V to breadboard + rail
2. Connect Arduino GND to breadboard - rail
3. Insert LED with anode (long leg) in one column
4. Insert resistor with one leg in same column as LED anode
5. Connect other resistor leg to + rail
6. Connect LED cathode (short leg) column to - rail

### Connecting components
- **Same column = connected**: Place component legs in different columns unless you want them connected
- **Across the gap**: ICs (chips) straddle the center gap so each pin is in its own column
- **Use jumper wires**: Connect different columns or to Arduino pins

### Power distribution
1. Connect Arduino 5V to one point on + rail
2. Connect Arduino GND to one point on - rail
3. Now any component connected to + gets power, any connected to - is grounded

## Common mistakes

### 1. Components in the same column (short circuit)
**Symptom**: Circuit doesn't work or component gets hot.
**Solution**: Each leg of a component should be in a different column (unless intentionally connected).

### 2. Expecting connection across the center gap
**Symptom**: Part of circuit doesn't work.
**Solution**: Use a jumper wire to connect across the gap if needed.

### 3. Power rails not connected
**Symptom**: Components don't receive power.
**Solution**: Connect the power rails to your power source (Arduino 5V and GND).

### 4. Wrong row assumption
**Symptom**: Components that should be connected aren't.
**Solution**: Remember: columns connect (A-E or F-J), not rows.

## Troubleshooting

| Problem | Check | Solution |
|---------|-------|----------|
| Component not powered | Power rail | Ensure + rail connected to 5V, - rail to GND |
| Components not connected | Same column? | Verify components share a column (vertical connection) |
| Short circuit | Shared column? | Ensure unintended components aren't in same column |
| IC not working | Center gap | Ensure IC straddles the gap properly |
| Intermittent connection | Wire seating | Push wires/components firmly into holes |

## Tips for clean circuits

1. **Use consistent wire colors**: Red for power, black for ground, other colors for signals
2. **Keep wires short**: Long wires are messy and can pick up interference
3. **Plan your layout**: Sketch the circuit before building
4. **Use the power rails**: Don't run individual wires from Arduino for every component that needs power/ground
5. **Label your circuit**: Note which rows connect to what
