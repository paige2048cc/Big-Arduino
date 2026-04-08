---
id: potentiometer
name: Potentiometer
aliases: [pot, variable resistor]
category: passive
pins:
  - name: VCC
    function: Power input
    notes: One outer terminal
  - name: SIG
    function: Analog output
    notes: Center wiper pin
  - name: GND
    function: Ground
    notes: Other outer terminal
common_issues:
  - Reading from the wrong pin
  - Forgetting to connect both power and ground
safety:
  - Keep voltage within the board input range
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno]
source_book: Arduino-book-master, 101-book-master
---

A potentiometer is a variable resistor commonly used as a manual analog input for brightness, threshold, or menu control.
