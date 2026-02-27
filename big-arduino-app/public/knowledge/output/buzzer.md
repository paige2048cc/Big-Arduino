---
id: buzzer
name: Piezo Buzzer
aliases: [piezo buzzer, beeper, speaker, passive buzzer, active buzzer]
category: output

pins:
  - name: POSITIVE
    function: Signal/Power input
    notes: Connect to digital pin (active) or PWM pin (passive). Marked with + symbol.
  - name: NEGATIVE
    function: Ground connection
    notes: Connect to GND. Marked with - symbol.

common_issues:
  - No sound (wrong pin type for passive buzzer)
  - Constant tone only (using active buzzer, cannot change frequency)
  - Weak sound (insufficient voltage)
  - Wrong polarity (reversed connections)

safety:
  - No current limiting resistor required
  - Do not exceed maximum voltage rating (typically 3-5V)
  - Prolonged exposure to loud buzzer sounds can be annoying

sources:
  - https://www.circuitbasics.com/how-to-use-active-and-passive-buzzers-on-the-arduino/
  - https://arduinogetstarted.com/tutorials/arduino-piezo-buzzer
  - https://deepbluembedded.com/arduino-active-passive-buzzer/
  - https://sensorkit.arduino.cc/sensorkit/module/lessons/lesson/04-the-buzzer
---

## What it is

A piezo buzzer is an electronic component that produces sound when voltage is applied. It uses the piezoelectric effect - a crystal that vibrates when electricity passes through it, creating sound waves.

There are two types:
- **Active Buzzer**: Has built-in oscillator, produces a fixed tone when powered
- **Passive Buzzer**: No internal oscillator, requires PWM signal to produce variable tones

## Pins

| Pin | Label | Description |
|-----|-------|-------------|
| POSITIVE | + | Signal input. Connect to digital pin (active) or PWM pin (passive). |
| NEGATIVE | - | Ground. Connect to Arduino GND. |

**Tip**: Look for the + symbol on the buzzer to identify the positive pin. Some buzzers have one pin longer than the other (longer = positive).

## How to identify Active vs Passive

| Feature | Active Buzzer | Passive Buzzer |
|---------|--------------|----------------|
| Internal oscillator | Yes | No |
| Sound with DC voltage | Yes (fixed tone) | No (needs AC/PWM) |
| Frequency control | No | Yes |
| Back cover | Usually sealed | Usually open |
| Test | Makes sound on 5V directly | Silent on DC, needs frequency |

## How to use

### Active Buzzer (simple on/off)

```cpp
const int buzzerPin = 8;

void setup() {
  pinMode(buzzerPin, OUTPUT);
}

void loop() {
  digitalWrite(buzzerPin, HIGH);  // Turn on buzzer
  delay(1000);
  digitalWrite(buzzerPin, LOW);   // Turn off buzzer
  delay(1000);
}
```

### Passive Buzzer with tone()

```cpp
const int buzzerPin = 9;  // PWM pin recommended

void setup() {
  pinMode(buzzerPin, OUTPUT);
}

void loop() {
  // Play a 1000Hz tone for 500ms
  tone(buzzerPin, 1000, 500);
  delay(1000);

  // Play a 500Hz tone for 500ms
  tone(buzzerPin, 500, 500);
  delay(1000);
}
```

### Playing a melody

```cpp
const int buzzerPin = 9;

// Note frequencies (Hz)
#define NOTE_C4  262
#define NOTE_D4  294
#define NOTE_E4  330
#define NOTE_F4  349
#define NOTE_G4  392

int melody[] = {NOTE_C4, NOTE_D4, NOTE_E4, NOTE_F4, NOTE_G4};
int noteDurations[] = {250, 250, 250, 250, 500};

void setup() {
  for (int i = 0; i < 5; i++) {
    tone(buzzerPin, melody[i], noteDurations[i]);
    delay(noteDurations[i] * 1.3);  // Pause between notes
  }
  noTone(buzzerPin);
}

void loop() {
  // Empty
}
```

### Alarm pattern

```cpp
const int buzzerPin = 9;

void alarm() {
  for (int i = 0; i < 3; i++) {
    tone(buzzerPin, 1000);
    delay(200);
    tone(buzzerPin, 1500);
    delay(200);
  }
  noTone(buzzerPin);
}

void setup() {
  alarm();
}

void loop() {
  // Empty
}
```

## Common mistakes

### 1. Using digitalWrite with passive buzzer
**Symptom**: No sound or just a click.
**Solution**: Use `tone()` function for passive buzzers. They need an AC signal (PWM), not DC.

### 2. Trying to change frequency on active buzzer
**Symptom**: Only one tone regardless of code.
**Solution**: Active buzzers have fixed frequency. Use a passive buzzer if you need variable tones.

### 3. Forgetting noTone()
**Symptom**: Buzzer continues playing after tone() call.
**Solution**: Call `noTone(pin)` to stop the sound, or specify duration in `tone(pin, freq, duration)`.

### 4. Reversed polarity
**Symptom**: No sound or very weak sound.
**Solution**: Check + and - markings. Connect + to signal pin, - to GND.

## Troubleshooting

| Problem | Check | Solution |
|---------|-------|----------|
| No sound | Buzzer type | Use tone() for passive, digitalWrite() for active |
| No sound | Wiring | Verify + to signal pin, - to GND |
| No sound | Pin mode | Ensure pinMode(pin, OUTPUT) is called |
| Weak sound | Voltage | Check power supply (3-5V typical) |
| Can't change tone | Buzzer type | You have an active buzzer, need passive for variable tones |
| Sound won't stop | Code | Add noTone(pin) or use duration parameter |

## Specifications (typical)

| Parameter | Active Buzzer | Passive Buzzer |
|-----------|--------------|----------------|
| Operating voltage | 3.5V - 5.5V | 3V - 5V |
| Current | 25-30mA | 30mA max |
| Frequency | Fixed (~2.5kHz) | 20Hz - 20kHz |
| Sound output | 85dB typical | Varies with frequency |
| Resonant frequency | N/A | ~2kHz |
