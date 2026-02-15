import type { Project } from '../../types';

export const ledButtonProject: Project = {
  id: 'led-button',
  title: 'Light up the LED',
  description: 'Light up an LED with Arduino - a beginner-friendly first circuit project.',
  difficulty: 'beginner',
  image: '/projects/led-button.png',
  estimatedTime: '15-20 min',
  components: [
    { name: 'Arduino Uno', quantity: 1 },
    { name: 'LED (any color)', quantity: 1 },
    { name: '220Ω Resistor', quantity: 1 },
    { name: 'Push Button', quantity: 1 },
    { name: 'Breadboard', quantity: 1 },
    { name: 'Jumper Wires', quantity: 4 },
  ],
  steps: [
    {
      id: 1,
      title: 'Gather Your Components',
      description: 'Let\'s make sure you have everything you need before we start.',
      instructions: [
        'Find your Arduino Uno board',
        'Get one LED (any color works!)',
        'Find one 220Ω resistor (red-red-brown stripes)',
        'Get one push button',
        'Grab your breadboard and 4 jumper wires',
      ],
      tips: [
        'The LED has two legs - the longer one is positive (+)',
        'The resistor protects the LED from too much current',
      ],
    },
    {
      id: 2,
      title: 'Connect Arduino to Computer',
      description: 'First, let\'s connect your Arduino and make sure it\'s recognized.',
      instructions: [
        'Plug the USB cable into your Arduino Uno',
        'Connect the other end to your computer',
        'You should see the green "ON" LED light up on the Arduino',
        'Click the "Connect Arduino" button below',
      ],
      tips: [
        'If the Arduino doesn\'t light up, try a different USB port',
        'Make sure you\'re using a data cable, not a charge-only cable',
      ],
    },
    {
      id: 3,
      title: 'Place the LED on Breadboard',
      description: 'Now let\'s set up the LED on your breadboard.',
      instructions: [
        'Place the LED on the breadboard',
        'The longer leg (positive/anode) should be in one row',
        'The shorter leg (negative/cathode) should be in an adjacent row',
        'Leave some space between them for the resistor',
      ],
      tips: [
        'Breadboard rows are connected horizontally',
        'The middle gap separates the two sides',
      ],
    },
    {
      id: 4,
      title: 'Add the Resistor',
      description: 'The resistor protects your LED from burning out.',
      instructions: [
        'Connect one end of the 220Ω resistor to the same row as the LED\'s shorter leg (cathode)',
        'Connect the other end to the negative rail (blue line) of the breadboard',
      ],
      tips: [
        'Resistors don\'t have a direction - either way works!',
        '220Ω has red-red-brown color bands',
      ],
    },
    {
      id: 5,
      title: 'Wire the LED to Arduino',
      description: 'Connect the LED to Arduino pin 13.',
      instructions: [
        'Use a jumper wire to connect the LED\'s longer leg (anode) row to Pin 13 on Arduino',
        'Use another jumper wire to connect the breadboard\'s negative rail to Arduino GND',
      ],
      tips: [
        'Pin 13 is special - it has a built-in resistor too',
        'GND means "ground" - it\'s the negative terminal',
      ],
      interactiveElements: [
        { type: 'led', pin: 13, label: 'LED' },
      ],
    },
    {
      id: 6,
      title: 'Add the Button',
      description: 'Now let\'s add a button to control the LED.',
      instructions: [
        'Place the push button across the middle gap of the breadboard',
        'Connect one leg of the button to Pin 2 on Arduino',
        'Connect the diagonal leg to GND through the negative rail',
      ],
      tips: [
        'The button has 4 legs - opposite corners are connected',
        'We\'re using Arduino\'s internal pull-up resistor',
      ],
      interactiveElements: [
        { type: 'led', pin: 13, label: 'LED' },
        { type: 'button', pin: 2, label: 'Button' },
      ],
    },
    {
      id: 7,
      title: 'Upload the Code',
      description: 'Time to bring it to life! Upload the code to your Arduino.',
      instructions: [
        'Open Arduino IDE on your computer',
        'Copy the code shown below',
        'Paste it into Arduino IDE',
        'Click the Upload button (→ arrow)',
        'Wait for "Done uploading" message',
      ],
      tips: [
        'Make sure the correct board (Arduino Uno) is selected in Tools > Board',
        'Select the right COM port in Tools > Port',
      ],
      code: `// Light up the LED
// Press the button to toggle the LED!

const int LED_PIN = 13;
const int BUTTON_PIN = 2;

bool ledState = false;
bool lastButtonState = HIGH;

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.println("Ready! Press button or send '1'/'0'");
}

void loop() {
  // Read button state
  bool buttonState = digitalRead(BUTTON_PIN);

  // Check for button press (HIGH to LOW transition)
  if (lastButtonState == HIGH && buttonState == LOW) {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    Serial.println(ledState ? "LED ON" : "LED OFF");
    delay(50); // Debounce
  }
  lastButtonState = buttonState;

  // Also check for serial commands
  if (Serial.available()) {
    char c = Serial.read();
    if (c == '1') {
      ledState = true;
      digitalWrite(LED_PIN, HIGH);
      Serial.println("LED ON");
    } else if (c == '0') {
      ledState = false;
      digitalWrite(LED_PIN, LOW);
      Serial.println("LED OFF");
    }
  }
}`,
      interactiveElements: [
        { type: 'led', pin: 13, label: 'LED' },
        { type: 'button', pin: 2, label: 'Button' },
      ],
    },
    {
      id: 8,
      title: 'Test Your Project!',
      description: 'Congratulations! Let\'s test everything works.',
      instructions: [
        'Press the physical button - the LED should toggle on/off',
        'Try the virtual button below - it controls the real LED too!',
        'Watch the LED indicator in the app mirror your real LED',
      ],
      tips: [
        'If the button doesn\'t work, check your wiring',
        'The virtual button sends commands via Web Serial',
      ],
      interactiveElements: [
        { type: 'led', pin: 13, label: 'LED' },
        { type: 'button', pin: 2, label: 'Button' },
      ],
    },
  ],
  arduinoCode: `// Light up the LED
const int LED_PIN = 13;
const int BUTTON_PIN = 2;
bool ledState = false;
bool lastButtonState = HIGH;

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.println("Ready!");
}

void loop() {
  bool buttonState = digitalRead(BUTTON_PIN);
  if (lastButtonState == HIGH && buttonState == LOW) {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    Serial.println(ledState ? "LED ON" : "LED OFF");
    delay(50);
  }
  lastButtonState = buttonState;

  if (Serial.available()) {
    char c = Serial.read();
    if (c == '1') {
      ledState = true;
      digitalWrite(LED_PIN, HIGH);
      Serial.println("LED ON");
    } else if (c == '0') {
      ledState = false;
      digitalWrite(LED_PIN, LOW);
      Serial.println("LED OFF");
    }
  }
}`,
};
