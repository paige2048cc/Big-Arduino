---
id: lcd1602-hello-world
name: LCD1602 Hello World
aliases: [lcd hello world, lcd text]
category: display-project
boards: [arduino-uno]
related_components: [arduino-uno, lcd1602-i2c]
concepts: [i2c-basics, display-output]
difficulty: easy
intent: display a simple message on an LCD1602 module
source_book: Arduino-book-master
source_files:
  - 8.1.5-LCDHelloworld.ino
---

Initialize the LCD library in `setup()`, call `lcd.print("Hello")`, and use the display for simple labels and sensor readouts.
