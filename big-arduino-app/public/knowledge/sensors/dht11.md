---
id: dht11
name: DHT11 Temperature & Humidity Sensor
aliases: [dht11, humidity sensor]
category: sensors
pins:
  - name: VCC
    function: Power input
    notes: Module supply
  - name: DATA
    function: Digital data
    notes: Single-wire style communication
  - name: GND
    function: Ground
    notes: Common reference
common_issues:
  - Polling the sensor too quickly
  - Forgetting the required library
safety:
  - Check whether a pull-up resistor is needed on your module version
boards: [arduino-uno]
related_components: [arduino-uno]
source_book: Arduino-book-master
---

DHT11 is a simple digital sensor that reports both temperature and humidity, though it is slower and less precise than more advanced sensors.
