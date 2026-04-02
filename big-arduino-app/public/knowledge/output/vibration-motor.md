---
id: vibration-motor
name: Vibration Motor
aliases: [coin motor, ERM motor, haptic motor, pancake motor, vibrator motor]
category: output

pins:
  - name: VCC
    function: Positive terminal
    notes: Connect to power source (typically 3V). Red wire on most modules.
  - name: GND
    function: Negative terminal
    notes: Connect to ground. Black wire on most modules.

common_issues:
  - Motor not vibrating (insufficient current from GPIO)
  - Motor vibrating weakly (voltage too low)
  - Arduino resetting (back-EMF spikes)
  - Motor overheating (continuous operation)

safety:
  - Never connect directly to Arduino pin if motor draws more than 20mA
  - Use a transistor or MOSFET as a switch for most vibration motors
  - Add a flyback diode to protect against back-EMF spikes
  - Secure the motor physically to prevent wire damage from vibration
  - Do not touch motor during operation (may be hot)

sources:
  - https://www.precisionmicrodrives.com/how-to-drive-a-vibration-motor-with-arduino-and-genuino
  - https://deepbluembedded.com/arduino-vibration-motor-code-circuit/
  - https://www.precisionmicrodrives.com/coin-vibration-motors
  - https://makeabilitylab.github.io/physcomp/advancedio/vibromotor.html
---

## What it is

A vibration motor (also called ERM - Eccentric Rotating Mass motor) is a small DC motor with an unbalanced mass attached to its shaft. When the motor spins, the eccentric mass creates vibration. These are the same motors used in smartphones for haptic feedback.

Coin-type vibration motors are flat, compact (7-12mm diameter), and operate at 2.5V-4V DC, drawing 50-120mA of current.

## Pins

| Pin | Label | Description |
|-----|-------|-------------|
| VCC | + | Positive terminal. Red wire. Connect to power through a transistor switch. |
| GND | - | Negative terminal. Black wire. Connect to ground. |

**Note**: Vibration motors are DC motors and technically non-polarized, but reversing polarity just reverses rotation direction (vibration still occurs).

## How to use

### Why you need a transistor

Most vibration motors draw 50-120mA of current. Arduino GPIO pins can only safely supply 20-40mA. Connecting a motor directly can damage your Arduino. Use a transistor (NPN like 2N2222) or MOSFET as a switch.

### Basic connection with transistor

**Components needed:**
- NPN transistor (2N2222, BC547, or similar)
- 1K ohm resistor (base resistor)
- 1N4001 diode (flyback protection)
- 0.1µF capacitor (optional, for noise filtering)

**Wiring:**
1. Connect motor VCC to 5V (or 3.3V) power supply
2. Connect motor GND to transistor Collector (C)
3. Connect transistor Emitter (E) to Arduino GND
4. Connect Arduino digital pin to transistor Base (B) through 1K resistor
5. Connect flyback diode across motor (cathode to VCC, anode to GND)

### Arduino code example

```cpp
const int motorPin = 3;  // PWM pin for variable intensity

void setup() {
  pinMode(motorPin, OUTPUT);
}

void loop() {
  // Turn on vibration
  digitalWrite(motorPin, HIGH);
  delay(1000);

  // Turn off vibration
  digitalWrite(motorPin, LOW);
  delay(1000);
}
```

### PWM control for variable vibration intensity

```cpp
const int motorPin = 3;  // Must be PWM pin (3, 5, 6, 9, 10, 11 on Uno)

void setup() {
  pinMode(motorPin, OUTPUT);
}

void loop() {
  // Gradually increase vibration
  for (int i = 0; i <= 255; i += 5) {
    analogWrite(motorPin, i);
    delay(50);
  }

  // Gradually decrease vibration
  for (int i = 255; i >= 0; i -= 5) {
    analogWrite(motorPin, i);
    delay(50);
  }
}
```

### Haptic feedback pattern example

```cpp
const int motorPin = 3;

void setup() {
  pinMode(motorPin, OUTPUT);
}

void vibratePulse(int duration, int pause, int count) {
  for (int i = 0; i < count; i++) {
    digitalWrite(motorPin, HIGH);
    delay(duration);
    digitalWrite(motorPin, LOW);
    delay(pause);
  }
}

void loop() {
  // Double pulse notification
  vibratePulse(100, 100, 2);
  delay(2000);
}
```

## Common mistakes

### 1. Direct connection to Arduino pin
**Symptom**: Motor barely vibrates or Arduino resets/behaves erratically.
**Solution**: Use a transistor circuit. Most vibration motors need 50-120mA, but Arduino pins can only supply 20-40mA.

### 2. Missing flyback diode
**Symptom**: Arduino resets randomly, transistor gets damaged over time.
**Solution**: Add a 1N4001 diode in reverse parallel across the motor to absorb back-EMF spikes when the motor turns off.

### 3. Motor not secured
**Symptom**: Motor jumps around, wires break, inconsistent vibration.
**Solution**: Secure the motor with tape, glue, or a mounting bracket. The vibration can cause mechanical stress on weak wire connections.

### 4. Using 5V on a 3V motor
**Symptom**: Motor runs hot, reduced lifespan, possible burnout.
**Solution**: Check motor specifications. Use appropriate voltage (most coin motors are rated 2.5-3.3V). Use PWM to reduce effective voltage if needed.

## Troubleshooting

| Problem | Check | Solution |
|---------|-------|----------|
| Motor not spinning | Power supply | Verify 3-5V at motor terminals |
| Motor not spinning | Transistor | Check base resistor and wiring |
| Motor weak | Voltage | Increase supply voltage (within spec) |
| Motor weak | Current | Ensure power supply can deliver 100mA+ |
| Arduino resetting | Back-EMF | Add flyback diode across motor |
| Erratic behavior | Noise | Add 0.1µF capacitor across motor |
| Motor overheating | Duty cycle | Reduce continuous run time, use PWM |

## Specifications (typical coin motor)

| Parameter | Value |
|-----------|-------|
| Operating voltage | 2.5V - 4V DC |
| Rated voltage | 3V DC |
| Rated current | 50-85mA |
| Starting current | Up to 120mA |
| Speed | 9000-12000 RPM |
| Vibration force | 0.5-2.0 GRMS |
| Diameter | 7-12mm |
| Operating temp | -20°C to +70°C |
