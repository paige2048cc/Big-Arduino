**Add your own guidelines here**
<!--

System Guidelines

Use this file to provide the AI with rules and guidelines you want it to follow.
This template outlines a few examples of things you can add. You can add your own sections and format it to suit your needs

TIP: More context isn't always better. It can confuse the LLM. Try and add the most important rules you need

# General guidelines

Any general rules you want the AI to follow.
For example:

* Only use absolute positioning when necessary. Opt for responsive and well structured layouts that use flexbox and grid by default
* Refactor code as you go to keep code clean
* Keep file sizes small and put helper functions and components in their own files.

--------------

# Design system guidelines
Rules for how the AI should make generations look like your company's design system

Additionally, if you select a design system to use in the prompt box, you can reference
your design system's components, tokens, variables and components.
For example:

* Use a base font-size of 14px
* Date formats should always be in the format “Jun 10”
* The bottom toolbar should only ever have a maximum of 4 items
* Never use the floating action button with the bottom toolbar
* Chips should always come in sets of 3 or more
* Don't use a dropdown if there are 2 or fewer options

You can also create sub sections and add more specific details
For example:


## Button
The Button component is a fundamental interactive element in our design system, designed to trigger actions or navigate
users through the application. It provides visual feedback and clear affordances to enhance user experience.

### Usage
Buttons should be used for important actions that users need to take, such as form submissions, confirming choices,
or initiating processes. They communicate interactivity and should have clear, action-oriented labels.

### Variants
* Primary Button
  * Purpose : Used for the main action in a section or page
  * Visual Style : Bold, filled with the primary brand color
  * Usage : One primary button per section to guide users toward the most important action
* Secondary Button
  * Purpose : Used for alternative or supporting actions
  * Visual Style : Outlined with the primary color, transparent background
  * Usage : Can appear alongside a primary button for less important actions
* Tertiary Button
  * Purpose : Used for the least important actions
  * Visual Style : Text-only with no border, using primary color
  * Usage : For actions that should be available but not emphasized
-->
## Workplace
 Deletion: You can now select a component on the workspace (it will highlight with a blue border) and press Enter (or Backspace/Delete) to remove it.
 Zooming: You can use the + (or =) key to zoom in and the - (or _) key to zoom out on the workspace.
 Panning: You can click and drag anywhere on the workspace background to move the canvas around.
 Drag and Drop with Zoom/Pan: Dragging new components onto the canvas now correctly accounts for the current zoom level and pan position, ensuring the item appears exactly where you drop it.
 Clicking a component selects it (allowing deletion), and clicking the background deselects it. Pan and Zoom only affect the canvas area.

#Tutorial
 Overlay: A 40% opacity dark background dims the interface to focus attention on the tutorial.
 Floating Tutorial Card: A yellow-themed card (#FFC85B) that matches your design file, featuring:
 Animations: Custom CSS/Motion animations for each step (simulating dragging components, checking off instructions, and chatting with AI).
 Step Navigation: "Skip" and "Next/I got it" buttons with a step counter (e.g., 1/3).

Content:
#Start: Guides the user to drag components (like the LED) into the workspace.
#Instructions: Explains how to use the instruction panel and get yellow checkmarks.
#Library: Tell user to check out knowledge of each components in library.
#AI Co-creation: Encourages co-creation using the chat feature.
The tutorial appears automatically when the project loads and can be dismissed by completing the steps or clicking "Skip".