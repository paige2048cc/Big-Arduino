# Big Arduino Component Data Model v2.1

## Purpose

This document defines the next-generation component data architecture for `Big Arduino`.

The goal is to:

- preserve the current strengths of `Big Arduino` in rendering, simulation, and breadboard interaction
- absorb the semantic strengths of `aily` pinmap data
- expand the knowledge layer beyond the current visible component list
- support future net enrichment from the pin generator without blocking current work
- make component data easier for AI to retrieve, explain, and reason about

This architecture uses three layers:

1. Component Definition Layer
2. Catalog Layer
3. Knowledge Layer

These layers are complementary and should not be merged into a single file format.

---

## Design Principles

### 1. Backward Compatible First

Existing `Big Arduino` component JSON remains the runtime foundation. New fields should be additive wherever possible.

### 2. Separate Runtime From Knowledge

Rendering and simulation fields belong in component JSON. Educational explanations, examples, and source citations belong in the knowledge layer.

### 3. Semantic Pins, Not Just Visual Pins

Each pin should eventually describe not only where it is drawn, but also what it can do electrically and how AI should describe it.

### 4. Incomplete Net Data Is Allowed

A component may be render-ready and knowledge-ready before its internal `net` or generated connectivity data is complete.

### 5. Retrieval Must Be AI-Friendly

The model should be easy to search by aliases, protocol, component family, common mistakes, and intended user questions.

### 6. One Source of Truth Per Concern

Avoid semantic duplication across layers. Runtime component JSON owns pin-level capability facts, the catalog owns discovery metadata, and the knowledge layer owns explanations and examples.

---

## Layer Overview

| Layer | Main Purpose | Storage | Used By |
|---|---|---|---|
| Component Definition Layer | Rendering, hit detection, simulation, basic pin semantics | `public/components/**/*.json` | canvas, simulator, placement, wiring |
| Catalog Layer | Discovery, indexing, variants, completion status, future expansion | `public/components/_catalog.json` | library UI, search, migration tooling, AI lookup |
| Knowledge Layer | Explanations, usage guidance, examples, safety, sources | `public/knowledge/**/*` | AI chat, onboarding, help content |

---

## Layer 1: Component Definition Layer

### Responsibility

This is the runtime component schema used by the app.

It must continue to support:

- image rendering
- canvas placement
- hit detection
- pin lookup
- component variants
- properties editing
- simulation rules
- breadboard insertion
- future semantic matching

### File Location

- `public/components/<category>/<component-id>.json`

Examples:

- `public/components/passive/led-5mm.json`
- `public/components/passive/pushbutton.json`
- `public/components/output/buzzer.json`

### Required Existing Fields

These fields remain first-class and must stay supported:

- `id`
- `name`
- `category`
- `image`
- `width`
- `height`
- `pins`
- `internalConnections`
- `variants`
- `properties`

### Existing Pin Fields To Preserve

- `id`
- `label`
- `description`
- `type`
- `x`
- `y`
- `hitRadius`
- `net`

### New v2 Fields

These fields should be added incrementally.

#### Component-Level Additions

- `schemaVersion`
- `libraryId`
- `modelId`
- `variantId`
- `primaryProtocol`
- `supportedProtocols`
- `aliases`
- `tags`
- `previewPins`
- `functionTypes`
- `knowledgeRefs`
- `source`
- `netStatus`
- `generatorHints`
- `compatibility`

#### Pin-Level Additions

- `functions`
- `electricalRole`
- `polarity`
- `preferredMatches`
- `aliases`
- `required`
- `notes`

### Recommended Component Schema

```json
{
  "schemaVersion": "2.0",
  "id": "led-5mm",
  "name": "LED (5mm)",
  "category": "passive",
  "libraryId": "core-basic",
  "modelId": "led_5mm",
  "variantId": "red",
  "primaryProtocol": "digital",
  "supportedProtocols": ["digital", "power"],
  "aliases": ["led", "light emitting diode", "5mm led"],
  "tags": ["basic", "polarized", "output"],
  "image": "LED_Red_OFF.png",
  "width": 40,
  "height": 71,
  "description": "Standard 5mm LED. Requires a current-limiting resistor.",
  "previewPins": ["ANODE", "CATHODE"],
  "functionTypes": [
    { "value": "power", "label": "VCC" },
    { "value": "gnd", "label": "GND" },
    { "value": "digital", "label": "Digital" }
  ],
  "pins": [
    {
      "id": "ANODE",
      "label": "Anode (+)",
      "description": "Positive terminal.",
      "type": "terminal",
      "x": 36,
      "y": 68,
      "hitRadius": 8,
      "electricalRole": "positive-input",
      "polarity": "positive",
      "aliases": ["+", "positive"],
      "functions": [
        { "name": "VCC_IN", "type": "power" },
        { "name": "SIGNAL_IN", "type": "digital" }
      ],
      "preferredMatches": ["5V", "3.3V", "digital-high", "pwm"],
      "required": true
    },
    {
      "id": "CATHODE",
      "label": "Cathode (-)",
      "description": "Negative terminal.",
      "type": "terminal",
      "x": 13,
      "y": 68,
      "hitRadius": 8,
      "electricalRole": "ground-return",
      "polarity": "negative",
      "aliases": ["-", "negative"],
      "functions": [
        { "name": "GND", "type": "gnd" }
      ],
      "preferredMatches": ["GND"],
      "required": true
    }
  ],
  "internalConnections": {
    "always": [["ANODE", "CATHODE"]],
    "notes": "Diode path; runtime simulator may still model direction explicitly."
  },
  "variants": {
    "red": { "image": "LED_Red_OFF.png" },
    "green": { "image": "LED_Green.png" }
  },
  "properties": {
    "color": {
      "type": "select",
      "options": ["red", "green", "blue", "yellow", "white"],
      "default": "red"
    }
  },
  "knowledgeRefs": {
    "component": "led-5mm",
    "concepts": ["digital-output", "pwm-output"],
    "recipes": ["blink-led", "fade-led-pwm"]
  },
  "source": {
    "origin": ["big-arduino", "aily-inspired", "101-book", "sparkfun-learn"],
    "confidence": "high"
  },
  "netStatus": "partial",
  "generatorHints": {
    "futurePinGenerator": true
  }
}
```

### Field Guidance

#### `primaryProtocol`

Use this only as the top-level classification that best describes the component in the library UI.

Examples:

- LED -> `digital`
- potentiometer -> `analog`
- HC-SR04 -> `digital`
- EEPROM chip -> `i2c`

#### `supportedProtocols`

Use this when a component can participate in more than one protocol or electrical interaction. This is the component-level summary for search and filtering.

#### `protocol`

If older files already use `protocol`, treat it as a legacy alias of `primaryProtocol` during migration. New v2.1 work should prefer `primaryProtocol`.

Use one of:

- `digital`
- `analog`
- `pwm`
- `i2c`
- `spi`
- `uart`
- `power`
- `other`

#### `functionTypes`

This is a compact semantic dictionary inspired by `aily` pinmap. It standardizes the allowed function type vocabulary used by `pins[].functions`.

This field is optional and should not become a second source of truth for actual pin capability. The authoritative fact stays in `pins[].functions`.

#### `pins[].functions`

This is the most important v2 addition. A pin may have one or more valid functions.

Examples:

- `A4` on Uno can expose both `analog` and `i2c`
- LED anode can accept `power` or driven `digital`
- buzzer positive can prefer `digital` or `pwm`

For AI and matching logic, this field is the primary semantic source.

#### `netStatus`

Use this to separate usability from completeness:

- `none`: no internal/generated net model yet
- `partial`: some net semantics exist, but generator enrichment is pending
- `complete`: usable for internal connectivity and generator workflows

### Compatibility Rules

#### Required for Current Runtime

To work in the current app, a component still needs:

- rendering fields
- pin coordinates
- `type`
- `internalConnections` if simulation depends on them

#### Optional in Early Migration

The following may be added gradually:

- `functionTypes`
- `pins[].functions`
- `knowledgeRefs`
- `generatorHints`
- `supportedProtocols`

#### Not Required Yet

These may remain incomplete until pin-generator integration:

- full internal `net` modeling for non-breadboard components
- board-specific matching tables
- generated layout metadata

---

## Layer 2: Catalog Layer

### Responsibility

The catalog is the discovery and indexing layer for all components, including components not yet visible in the current toolbar.

This layer should answer:

- what components exist
- which variants exist
- what protocol they use
- how complete they are
- whether knowledge exists
- whether runtime JSON exists

### File Location

- `public/components/_catalog.json`

### Why This Layer Is Needed

Current component loading is file-based. That works for rendering, but not for:

- scalable search
- hidden or future components
- structured completion status
- variant discovery
- migration tooling
- AI-aware component discovery

### Catalog Structure

```json
{
  "version": "2.0",
  "components": [
    {
      "id": "led-5mm",
      "name": "LED (5mm)",
      "category": "passive",
      "libraryId": "core-basic",
      "modelId": "led_5mm",
      "defaultVariant": "red",
      "primaryProtocol": "digital",
      "supportedProtocols": ["digital", "power"],
      "aliases": ["led", "indicator led", "5mm led"],
      "tags": ["basic", "polarized", "starter"],
      "componentPath": "passive/led-5mm.json",
      "knowledgeId": "led-5mm",
      "variants": [
        {
          "id": "red",
          "name": "Red",
          "componentPath": "passive/led-5mm.json",
          "status": "available"
        }
      ],
      "previewPins": ["ANODE", "CATHODE"],
      "renderReady": true,
      "simulationReady": true,
      "knowledgeReady": true,
      "netStatus": "partial",
      "visibleInLibrary": true
    }
  ]
}
```

### Catalog Status Fields

- `renderReady`
- `simulationReady`
- `knowledgeReady`
- `netStatus`
- `visibleInLibrary`

This makes it possible to include future components before every downstream detail is complete.

### Catalog Ownership Rules

- `id` is the stable business identifier used across runtime, catalog, and knowledge
- `componentPath` is the file locator owned by the catalog
- `knowledgeId` should usually equal `id` unless there is a deliberate many-to-one mapping
- `libraryId`, `modelId`, and `defaultVariant` are discovery metadata and must not replace `id` as the primary join key

### Catalog Use Cases

#### Component Library UI

- populate the visible component list
- filter by category, tags, protocol, beginner level

#### AI Search

- discover related components not currently placed
- suggest alternatives or missing parts

#### Migration Tooling

- track which components are still v1-only
- track missing knowledge or net enrichment

#### Future Generator Integration

- mark components waiting on pin-generator output

---

## Layer 3: Knowledge Layer

### Responsibility

The knowledge layer stores explanations, examples, source attribution, common issues, safety notes, and educational framing for AI and onboarding.

It should not be burdened with canvas coordinates or simulation behavior.

### Existing Structure To Keep

Current knowledge structure is already a strong base:

- `public/knowledge/_index.json`
- `public/knowledge/components/*.md`
- `public/knowledge/concepts/*.md`
- `public/knowledge/recipes/*.md`

### Knowledge Kinds

- `components`
- `concepts`
- `recipes`

### Recommended Role Split

#### `components`

Use for:

- what the part is
- pin meanings
- polarity
- wiring rules
- typical use
- common mistakes
- safety notes

#### `concepts`

Use for:

- `INPUT_PULLUP`
- PWM
- current limiting
- polarity
- analog vs digital
- breadboard row logic

#### `recipes`

Use for:

- blink LED
- button controls LED
- play buzzer tone
- button-controlled buzzer
- fade RGB LED

Recipes are not just prose examples. They should also support deterministic AI code generation.

### Recommended Knowledge Frontmatter

The existing knowledge frontmatter should be kept and expanded only when necessary.

Recommended fields:

- `id`
- `name`
- `aliases`
- `category`
- `pins`
- `common_issues`
- `safety`
- `sources`
- `boards`
- `related_components`
- `concepts`
- `libraries`
- `difficulty`
- `intent`
- `source_book`
- `source_files`

### Recipe-Specific Frontmatter

For `recipes`, add structured fields instead of forcing AI to infer everything from Markdown prose.

Recommended recipe-only fields:

- `required_components`
- `optional_components`
- `pin_constraints`
- `code_template`
- `placeholders`
- `expected_behavior`
- `output_type`

`code_template` may stay in the Markdown body for readability in early migration, but the long-term preferred model is structured template metadata plus a human-readable explanation.

### Example Component Knowledge Entry

````md
---
id: led-5mm
name: LED (5mm)
aliases: [led, light emitting diode, 5mm led]
category: passive
pins:
  - name: ANODE
    function: Positive input
    notes: Usually the longer leg
  - name: CATHODE
    function: Ground return
    notes: Usually the shorter leg and flat-side marker
common_issues:
  - Reversed polarity prevents lighting
  - Missing resistor can damage the LED
safety:
  - Use a current-limiting resistor
sources:
  - Arduino 101 Experiment 1
  - SparkFun LED tutorial
source_book: 101-book-master
source_files:
  - Experiment 1: Blink LED
---

An LED is a polarized semiconductor component that emits light when current flows from anode to cathode.
````

### Example Recipe Knowledge Entry

```md
---
id: button-controls-led
name: Button Controls LED
aliases: [button led, press button led]
category: starter-project
boards: [arduino-uno, arduino-101]
related_components: [arduino-uno, pushbutton, led-5mm, resistor-220]
concepts: [input-pullup, digital-output]
difficulty: easy
intent: generate code for button input controlling an LED
required_components:
  - arduino-uno
  - pushbutton
  - led-5mm
  - resistor-220
pin_constraints:
  buttonPin: { types: [digital] }
  ledPin: { types: [digital, pwm] }
placeholders:
  - buttonPin
  - ledPin
output_type: cpp
expected_behavior: LED turns on while the button is pressed
source_book: Arduino-book-master
source_files:
  - 2.5.1-ButtonAndLED.ino
---

## Code Template

```cpp
const int buttonPin = {{buttonPin}};
const int ledPin = {{ledPin}};

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
}

void loop() {
  bool pressed = digitalRead(buttonPin) == LOW;
  digitalWrite(ledPin, pressed ? HIGH : LOW);
}
```
```

### Knowledge Retrieval Requirements

Knowledge entries should be searchable by:

- component id
- aliases
- protocol
- related components
- board
- educational intent
- common beginner wording
- placed component ids
- explicit `knowledgeRefs`
- recipe suitability for code generation

Examples of beginner phrasing that should match:

- "why is my led not lighting"
- "which side of button goes to 5v"
- "what does buzzer positive pin connect to"
- "do i need resistor with led"

---

## Relationship Between Layers

### Component JSON -> Knowledge

Runtime definitions should reference knowledge via `knowledgeRefs`.

### Catalog -> Component JSON

The catalog tells the app where the runtime component file lives.

### Catalog -> Knowledge

The catalog links runtime objects to educational content.

### AI Retrieval

AI should prefer this order:

1. current circuit state
2. explicit component `knowledgeRefs`
3. runtime component definition semantics
4. direct knowledge lookup by stable id
5. related concepts and recipes through search fallback

### AI Retrieval Contract

The retrieval layer should accept:

- `board`
- `placedComponents`
- `referencedComponents`
- `userQuery`
- optional `intent` such as `debug`, `explain`, or `generate-code`

The retrieval layer should return:

- `components[]`
- `concepts[]`
- `recipes[]`
- `assumptions[]`
- `rankingMetadata`

Expected retrieval behavior:

- if a component has explicit `knowledgeRefs`, use those first
- if the user asks for code, rank `recipes` above `concepts`
- if the user asks for explanation, rank `concepts` and `components` above `recipes`
- if no exact reference exists, fallback to alias, board, related component, and beginner-phrase matching
- never return board-incompatible recipes ahead of compatible ones

---

## Migration Strategy

### Phase 1: Define the Standard

Deliverables:

- this document
- new `_catalog.json` spec
- additive type extensions in code later

No runtime breakage should occur in this phase.

### Phase 2: Upgrade Core Components

First target set:

- `arduino-uno`
- `breadboard`
- `led-5mm`
- `pushbutton`
- `buzzer`
- `resistor`

Goals:

- add semantic pin functions
- add `knowledgeRefs`
- add catalog entries

### Phase 3: Expand Knowledge Coverage

Add or refine knowledge for:

- foundational components from current app
- components from `aily` pinmap that fit the learning goals
- foundational parts described in `Arduino-book` and `101-book`
- external educational sources referenced by those books

### Phase 4: Add Net Enrichment

Use pin-generator output to progressively fill:

- internal net structures
- complex connectivity hints
- board mapping helpers

Components may remain usable before this phase completes.

---

## Adoption Rules

### Rule 1

Do not remove current rendering or simulation fields just to match `aily`.

### Rule 2

Do not force every component to be fully net-modeled before it can enter the catalog.

### Rule 3

All new component work should update:

- the runtime component JSON if the component is renderable
- the catalog entry if it should be discoverable
- the knowledge layer if AI should explain it

### Rule 4

When educational sources disagree with a datasheet or library behavior, prefer:

1. datasheet or official hardware documentation
2. stable runtime behavior in the app
3. educational simplification for beginner-facing explanations

### Rule 5

When future pin-generator output arrives, it should enrich existing definitions rather than forcing a separate incompatible schema.

### Rule 6

Do not create the same semantic fact in multiple fields unless the document explicitly marks one field as derived metadata.

---

## Initial Scope Recommendation

The first wave of v2 migration should prioritize beginner-friendly foundational components:

- LED
- RGB LED
- pushbutton
- resistor
- buzzer
- potentiometer
- breadboard
- Arduino Uno

These provide the best overlap between:

- current `Big Arduino` features
- `aily` semantic inspiration
- textbook educational value
- AI help quality

---

## Success Criteria

The v2 data model is successful when:

- existing components still render and simulate correctly
- the app can index components beyond the current visible library
- AI can answer beginner questions using structured component and knowledge data
- components can enter the system before net enrichment is complete
- future pin-generator output can be added without redesigning the schema again
