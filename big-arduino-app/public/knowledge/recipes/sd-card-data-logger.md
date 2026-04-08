---
id: sd-card-data-logger
name: SD Card Data Logger
aliases: [sd logger, microsd log, file write]
category: module-project
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno, microsd-module]
concepts: [data-logging]
difficulty: medium
intent: write text data to a microSD card
source_book: Arduino-book-master, 101-book-master
source_files:
  - 6.1.11-SDWrite.ino
  - 9.2.1-filewrite.ino
---

Initialize the SD library, open a file, write measurements or status text, and close the file so the data is safely saved.
