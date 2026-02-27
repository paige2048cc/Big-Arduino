# Big Arduino - Product Requirements Document

## Document Information
- **Project**: Big Arduino - AI-Assisted Physical Computing Learning Platform
- **Version**: 1.0
- **Date**: January 2026
- **Research Context**: MFA Thesis - SCAD Interactive Design and Game Development
- **Researchers**: Qingpei Cai & Xinjin Xu

---

## 1. Executive Summary

### 1.1 Project Vision
Big Arduino is a web-based learning platform that enables beginners to learn physical computing (Arduino) through **Human-AI Co-Creation** and **Visual Interface Design**. The platform aims to reduce barriers, enhance self-efficacy, and make physical computing accessible, engaging, and confidence-building for novices.

### 1.2 Research Focus
This project addresses two complementary research questions:

**Qingpei Cai's Focus**: How can the Human-AI Co-Creation Model be applied to physical computing platforms to enable beginners to co-create with AI?

**Xinjin Xu's Focus**: How does visual instructional interface design influence the self-efficacy, learning efficiency, and task accuracy of beginners learning Arduino?

### 1.3 Problem Statement
Based on research findings:
1. **Uncritical AI Use**: 61% of beginners copy AI responses blindly, even when incorrect
2. **Learning Barriers Remain**: Users feel overwhelmed due to poor guidance despite tools claiming to lower learning curves
3. **Lack of Visual Guidance**: Existing tools lack clear circuit visualization and step-by-step visual instructions

---

## 2. Theoretical Framework

### 2.1 Human-AI Co-Creation Model
*Reference: Wu et al., "AI Creativity and the Human-AI Co-creation Model" (2021)*

The design follows a cyclical co-creation process:
- **Perceive**: Enhanced by big data & sensors with AI
- **Collaborate**: Human & AI play to each other's strengths
- **Express**: Explore more & rapidly with AI
- **Think**: Think deeper & wider with AI
- **Build**: Achieve high quality & low cost with AI
- **Test**: Simulate & analyze with AI

### 2.2 Creativity Support Tools Framework
*Reference: Shneiderman, "Creativity support tools" (2007)*

The platform must support:
- **Exploration**: Easy to explore many different options
- **Expression**: Be very expressive and creative
- **Collaboration**: Work together with others (including AI)
- **Engagement**: Absorbing and enjoyable experience
- **Effort/Reward Tradeoff**: Worth the effort to produce results

### 2.3 Self-Efficacy Theory
*Reference: Bandura, "Self-efficacy: Toward a Unifying Theory of Behavioral Change" (1977)*

Design must build self-efficacy through:
- **Mastery Experiences**: Step-by-step successes
- **Vicarious Experiences**: See examples of successful projects
- **Social Persuasion**: Encouraging AI feedback
- **Physiological States**: Reduce anxiety through clear guidance

### 2.4 Distributed Cognition
*Reference: Hollan, Hutchins & Kirsh, "Distributed Cognition" (2000)*

Cognition is distributed across:
- The user (human learner)
- The AI assistant (collaborative partner)
- The physical tools (Arduino, components)
- The visual interface (circuit diagrams, instructions)

---

## 3. Target Audience

### 3.1 Primary Users
- **Beginner Arduino learners** (especially non-engineering/creative backgrounds)
- **Design students** in physical computing or interaction design courses
- **Novice makers** who benefit from AI-guided learning
- **STEM educators** seeking accessible teaching tools

### 3.2 User Characteristics
| Characteristic | Description |
|----------------|-------------|
| Technical Background | Little to no prior electronics/coding experience |
| Learning Style | Visual learners who prefer diagrams over text |
| Motivation | Creative projects, prototyping ideas |
| Age Range | 18-35 (primarily university students) |
| Device | Desktop/laptop with Chrome or Edge browser |

### 3.3 User Personas

**Persona 1: Creative Student**
- Art/design background, no engineering experience
- Wants to add interactivity to art installations
- Frustrated by text-heavy Arduino tutorials
- Needs visual, step-by-step guidance

**Persona 2: Self-Learner**
- Hobbyist interested in DIY electronics
- Has tried Arduino before but gave up
- Wants immediate feedback and validation
- Needs confidence-building small wins

---

## 4. Functional Requirements

### 4.1 Visual Interface Requirements

#### FR-V01: Bright Theme Design
- **Priority**: High
- **Description**: UI must use a bright, Figma/Google-inspired color palette
- **Acceptance Criteria**:
  - White/light gray backgrounds (#ffffff, #f8f9fa, #f1f3f4)
  - Google-style accent colors (blue #1a73e8, green #34a853)
  - Clean, minimal design with ample whitespace
  - Inter font family for typography

#### FR-V02: Three-Panel Layout
- **Priority**: High
- **Description**: Second-level interface (after project selection) uses 3-panel layout
- **Acceptance Criteria**:
  - Left panel (~250px): Component library + code toggle
  - Center panel (flexible): Circuit canvas workspace
  - Right panel (~350px): Instructions + chat dialog
  - Resizable panels with draggable dividers
  - Responsive behavior on smaller screens

#### FR-V03: Visual Step Indicators
- **Priority**: High
- **Description**: Clear progress visualization throughout learning journey
- **Acceptance Criteria**:
  - Progress bar showing all steps
  - Current step highlighted
  - Completed steps marked with checkmark
  - Clickable navigation to any previous step

### 4.2 Circuit Canvas Requirements

#### FR-C01: Interactive Canvas Workspace
- **Priority**: High
- **Description**: Central workspace for circuit building and visualization
- **Acceptance Criteria**:
  - Canvas occupies largest portion of screen
  - Grid background with snap-to-grid
  - Zoom controls (mouse wheel + buttons)
  - Pan capability (drag or scroll)
  - Clear visualization of complete wiring

#### FR-C02: Component Library
- **Priority**: High
- **Description**: Draggable component library on left panel
- **Acceptance Criteria**:
  - Categorized components (boards, basic, input, output, sensors)
  - Visual thumbnails for each component
  - Drag-and-drop from library to canvas
  - Search/filter functionality
  - Components include:
    - Arduino Uno
    - Breadboard (standard 830-point)
    - LEDs (red, green, blue, yellow, white)
    - Resistors (various values with color bands)
    - Push buttons
    - Soil moisture sensor
    - Jumper wires (multiple colors)

#### FR-C03: Wire Drawing
- **Priority**: High
- **Description**: Users can draw wires to connect components
- **Acceptance Criteria**:
  - Click-to-start, click-to-end wire creation
  - Visual feedback during drawing (preview line)
  - Pin snapping with visual indicators
  - Wire color selection
  - Wire deletion capability

#### FR-C04: Component Manipulation
- **Priority**: High
- **Description**: Users can manipulate placed components
- **Acceptance Criteria**:
  - Select components by clicking
  - Move components by dragging
  - Rotate components (90-degree increments)
  - Delete selected components
  - Multi-select for group operations

### 4.3 Simulation Requirements

#### FR-S01: Realistic Circuit Simulation
- **Priority**: High
- **Description**: Accurate electrical behavior simulation
- **Acceptance Criteria**:
  - Voltage/current calculation using Modified Nodal Analysis
  - LED brightness based on actual current flow
  - Button state affects circuit continuity
  - Real-time updates at minimum 30fps

#### FR-S02: Error Detection
- **Priority**: High
- **Description**: Detect and display circuit errors
- **Acceptance Criteria**:
  - Short circuit detection with warning
  - Over-current detection (>20mA for standard LEDs)
  - Missing ground/power warning
  - Reverse polarity detection for LEDs
  - Visual highlighting of problematic components
  - Clear error messages with suggested fixes

#### FR-S03: Component Burnout Simulation
- **Priority**: Medium
- **Description**: Simulate component damage from incorrect wiring
- **Acceptance Criteria**:
  - LED burnout when current exceeds max rating
  - Visual indication of damaged components
  - Educational message explaining why damage occurred

### 4.4 Interactive Preview Requirements

#### FR-P01: Project Preview Mode
- **Priority**: High
- **Description**: Full project preview before guided steps
- **Acceptance Criteria**:
  - Show complete circuit at project start
  - Interactive without physical Arduino connection
  - Click virtual button → LED responds
  - Clear explanation of expected behavior
  - "Try It" vs "Build It" mode toggle

#### FR-P02: Step-by-Step Animated Guidance
- **Priority**: High
- **Description**: Animated guidance for each building step
- **Acceptance Criteria**:
  - Highlight current component to place
  - Animate component movement to position
  - Show wire routing animation
  - Pause/play controls for animations
  - Speed adjustment for animations

### 4.5 Instruction Panel Requirements

#### FR-I01: Visual Flow Diagrams
- **Priority**: High (Xinjin's research focus)
- **Description**: Modular visual instructions instead of text-only
- **Acceptance Criteria**:
  - Each step represented as visual block
  - Component icons (LED, button, wire)
  - Color-coded wiring diagrams
  - Visual tips with icons
  - Reduced text, increased visual elements

#### FR-I02: Step Instructions
- **Priority**: High
- **Description**: Clear instructions for each step
- **Acceptance Criteria**:
  - Step number and title
  - Brief description
  - Numbered instruction list
  - Optional tips section
  - Arduino code snippet (when applicable)
  - Copy code button

### 4.6 Chat/Dialog Requirements

#### FR-D01: Chat Panel
- **Priority**: Medium
- **Description**: AI assistant chat panel for questions
- **Acceptance Criteria**:
  - Accessible in right panel
  - Message input at bottom
  - Conversation history visible
  - Clear distinction between user and AI messages
  - Context-aware responses (knows current step)

#### FR-D02: Conversation History
- **Priority**: Medium
- **Description**: Persistent conversation during session
- **Acceptance Criteria**:
  - All messages preserved during session
  - Scrollable message history
  - Timestamps on messages
  - Clear visual hierarchy

### 4.7 Arduino Connection Requirements

#### FR-A01: Web Serial Connection
- **Priority**: High
- **Description**: Connect to physical Arduino via Web Serial API
- **Acceptance Criteria**:
  - Connect/disconnect buttons
  - Connection status indicator
  - Automatic baud rate configuration
  - Browser compatibility warning (Chrome/Edge only)
  - Error handling for failed connections

#### FR-A02: Physical-Virtual Sync
- **Priority**: High
- **Description**: Sync virtual and physical Arduino states
- **Acceptance Criteria**:
  - Virtual button click → physical LED response
  - Physical sensor data → virtual display
  - Real-time data visualization
  - Latency under 100ms

### 4.8 Code View Requirements

#### FR-CV01: Code Editor Panel
- **Priority**: Medium
- **Description**: View and edit Arduino code
- **Acceptance Criteria**:
  - Toggle between component library and code view
  - Syntax highlighting for Arduino/C++
  - Copy to clipboard functionality
  - Read-only mode for guided projects
  - Line numbers

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

#### NFR-P01: Render Performance
- Canvas must maintain 60fps during normal interaction
- Simulation updates at minimum 30fps
- Initial page load under 3 seconds
- Component drag-drop response under 50ms

#### NFR-P02: Memory Usage
- Browser memory usage under 500MB
- Support circuits with up to 50 components
- No memory leaks during extended use

### 5.2 Usability Requirements

#### NFR-U01: Learnability
- New users should complete first project within 15 minutes
- Interface should be usable without external documentation
- Tooltips on all interactive elements

#### NFR-U02: Accessibility
- Keyboard navigation support
- Screen reader compatible elements
- Minimum contrast ratio 4.5:1
- Focus indicators on interactive elements

#### NFR-U03: Error Prevention
- Confirm before deleting components
- Undo/redo support (minimum 20 actions)
- Auto-save circuit state

### 5.3 Compatibility Requirements

#### NFR-C01: Browser Support
- Chrome 90+ (primary)
- Edge 90+ (primary)
- Firefox 90+ (limited - no Web Serial)
- Safari (limited - no Web Serial)

#### NFR-C02: Screen Size
- Minimum: 1024x768 pixels
- Optimal: 1920x1080 pixels
- Responsive down to 768px width

### 5.4 Security Requirements

#### NFR-S01: Data Privacy
- No personal data collection without consent
- Circuit data stored locally only
- No external API calls for core functionality

---

## 6. User Experience Requirements

### 6.1 Self-Efficacy Enhancement
Based on Bandura's Self-Efficacy Theory:

#### UX-SE01: Mastery Experiences
- Break complex tasks into achievable steps
- Immediate positive feedback on correct actions
- Visual celebration on step completion
- Progress tracking visible at all times

#### UX-SE02: Reduce Perceived Difficulty
- Use visual diagrams instead of text-heavy instructions
- Show expected outcome before building
- Provide hints before users make mistakes
- Clear error messages with solutions

### 6.2 Cognitive Load Reduction
Based on Weinschenk's research on cognitive load:

#### UX-CL01: Information Chunking
- Maximum 5-7 items per visual group
- One primary action per step
- Progressive disclosure of complex information

#### UX-CL02: Visual Hierarchy
- Clear distinction between primary and secondary actions
- Consistent placement of navigation elements
- Color coding for component types

### 6.3 Creativity Support
Based on CSI framework:

#### UX-CS01: Exploration Support
- Allow experimentation without penalty
- Easy to start over or undo
- Preview mode for testing ideas

#### UX-CS02: Expression Support
- Support custom projects beyond presets
- Allow modification of existing projects
- Save and share capabilities (future)

---

## 7. Content Requirements

### 7.1 Preset Projects

#### Project 1: LED Button Controller (Beginner)
- Components: Arduino Uno, LED, 220Ω resistor, push button, breadboard, wires
- Steps: 8
- Learning outcomes: Basic circuit, digital I/O, button input

#### Project 2: Traffic Light System (Intermediate)
- Components: Arduino Uno, 3 LEDs, 3 resistors, breadboard, wires
- Steps: 10-12
- Learning outcomes: Multiple outputs, timing, state machines

#### Project 3: Plant Watering Reminder (Intermediate)
- Components: Arduino Uno, soil moisture sensor, LED, buzzer, breadboard, wires
- Steps: 10-12
- Learning outcomes: Analog input, sensor reading, conditional logic

### 7.2 Component Specifications
Each component definition must include:
- Visual representation (SVG)
- Pin definitions with types
- Electrical properties
- Common usage tips

---

## 8. Validation Requirements

### 8.1 Research Metrics

#### Creativity Support Index (CSI)
Measure on 20-point scale:
- Exploration
- Collaboration
- Engagement
- Effort/Reward Tradeoff
- Tool Transparency
- Expressiveness

#### System Usability Scale (SUS)
10-item questionnaire measuring:
- Ease of use
- Learnability
- Confidence
- Consistency

#### Self-Efficacy Scale
Pre/post task surveys measuring:
- Confidence in completing Arduino tasks
- Perceived difficulty reduction
- Willingness to attempt new projects

### 8.2 Task Performance Metrics
- Task completion time
- Error rate
- Number of help requests
- Steps completed without assistance

---

## 9. Technical Constraints

### 9.1 Technology Stack
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Canvas Library**: Fabric.js
- **State Management**: Zustand
- **Styling**: CSS with custom properties
- **Icons**: Lucide React

### 9.2 Browser APIs
- Web Serial API (Chrome/Edge only)
- Clipboard API
- Local Storage API

### 9.3 Known Limitations
- Web Serial not supported in Firefox/Safari
- No offline functionality in initial release
- AI chat placeholder only (no real AI integration initially)

---

## 10. Success Criteria

### 10.1 Research Success
- Statistically significant improvement in self-efficacy scores (paired t-test)
- CSI scores above 70/100
- SUS scores above 68 (industry average)

### 10.2 User Success
- 80% of users complete first project within 20 minutes
- Error rate below 20% per step
- Positive qualitative feedback in post-task interviews

### 10.3 Technical Success
- All functional requirements implemented
- No critical bugs in release
- Performance requirements met

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **Self-Efficacy** | Belief in one's capability to execute behaviors necessary to produce specific outcomes |
| **CSI** | Creativity Support Index - standardized evaluation metric for creativity tools |
| **SUS** | System Usability Scale - standardized usability questionnaire |
| **MNA** | Modified Nodal Analysis - method for analyzing electrical circuits |
| **Physical Computing** | Building interactive physical systems using software and hardware |
| **Web Serial API** | Browser API for communication with serial devices |

---

## 12. References

1. Wu, Z., Ji, D., Yu, K., Zeng, X., Wu, D., & Shidujaman, M. (2021). AI Creativity and the Human-AI Co-creation Model. *Lecture Notes in Computer Science*.

2. Shneiderman, B. (2007). Creativity support tools - Accelerating discovery and innovation. *Communications of the ACM*, 50(12), 20-32.

3. Bandura, A. (1977). Self-efficacy: Toward a unifying theory of behavioral change. *Psychological Review*, 84(2), 191-215.

4. Hollan, J., Hutchins, E., & Kirsh, D. (2000). Distributed Cognition: Toward a New Foundation for Human-Computer Interaction Research. *ACM Transactions on Computer-Human Interaction*, 7(2), 174-196.

5. Cherry, E., & Latulipe, C. (2014). Quantifying the Creativity Support of Digital Tools through the Creativity Support Index. *ACM Transactions on Computer-Human Interaction*, 21(4).

6. Brooke, J. (1996). SUS: A 'Quick and Dirty' Usability Scale. *Usability Evaluation in Industry*, 189-194.

7. Weinschenk, S. (2011). *100 Things Every Designer Needs to Know About People*. New Riders.

8. Illeris, K. (2018). *Contemporary Theories of Learning* (2nd ed.). Routledge.
