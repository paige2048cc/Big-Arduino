---
id: microsd-module
name: MicroSD Module
aliases: [sd module, microsd, sd card module]
category: modules
pins:
  - name: CS
    function: Chip select
    notes: Select pin for the SPI device
  - name: MOSI
    function: SPI data input
    notes: Connect to board MOSI
  - name: MISO
    function: SPI data output
    notes: Connect to board MISO
  - name: SCK
    function: SPI clock
    notes: Connect to board SCK
common_issues:
  - Using the wrong chip select pin in code
  - Removing power before closing the file
safety:
  - Safely stop writes before removing the card
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno]
source_book: Arduino-book-master, 101-book-master
---

MicroSD modules add removable storage to Arduino projects and are commonly used for logging data or reading files.
