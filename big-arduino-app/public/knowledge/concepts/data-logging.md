---
id: data-logging
name: Data Logging
aliases: [sd write, file write, save sensor data]
category: storage
boards: [arduino-uno, arduino-101]
related_components: [microsd-module]
common_issues:
  - Using the wrong chip select pin
  - Forgetting to initialize the SD library
  - Removing power while a write is in progress
safety:
  - Safely stop writes before removing the card
source_book: Arduino-book-master, 101-book-master
source_files:
  - 6.1.11-SDWrite.ino
  - 9.2.1-filewrite.ino
---

Data logging stores measurements to removable storage so the project can keep records beyond the current serial session.
