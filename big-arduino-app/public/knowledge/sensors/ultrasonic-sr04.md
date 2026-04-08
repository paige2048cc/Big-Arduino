---
id: ultrasonic-sr04
name: HC-SR04 Ultrasonic Sensor
aliases: [sr04, hc-sr04, ultrasonic sensor]
category: sensors
pins:
  - name: VCC
    function: Power input
    notes: Module supply
  - name: TRIG
    function: Trigger input
    notes: Send a short pulse
  - name: ECHO
    function: Echo output
    notes: Pulse width represents distance
  - name: GND
    function: Ground
    notes: Common reference
common_issues:
  - Swapping TRIG and ECHO
  - Measuring poor reflective targets
safety:
  - Do not exceed the specified supply voltage
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno]
source_book: Arduino-book-master, 101-book-master
---

The HC-SR04 measures distance by sending an ultrasonic pulse and timing how long it takes to return.
