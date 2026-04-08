---
id: ultrasonic-distance-monitor
name: Ultrasonic Distance Monitor
aliases: [sr04 distance, ultrasonic monitor]
category: sensor-project
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno, ultrasonic-sr04]
concepts: [distance-sensing, serial-basics]
difficulty: medium
intent: generate code for HC-SR04 distance measurement
source_book: Arduino-book-master, 101-book-master
source_files:
  - 3.3.1-Sr04.ino
  - 3.2.1-sr04.ino
---

```cpp
const int trigPin = 9;
const int echoPin = 10;

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH);
  float distanceCm = duration * 0.0343 / 2.0;
  Serial.println(distanceCm);
  delay(200);
}
```
