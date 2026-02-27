# Style Playground - Design Exploration Rules

## Purpose

The Style Playground is a **visual exploration tool** for Big Arduino app UI styles. It focuses on **visual style and layout only** - original functionality is not required, but page styling and structure should be present.

## Project Structure

### Tabs Organization

| Tab | Purpose | Content |
|-----|---------|---------|
| **Homepage Layout** | Explore homepage/landing page styles | Multiple style variations (A-G+) for the main entry page |
| **Secondary Page** | Explore in-app page styles | Styles for the project workspace, dashboard, or chat interface |
| **Card Styles** | Component-level exploration | Various card component designs |
| **Button Styles** | Component-level exploration | Various button component designs |

### Key Principle

- **Homepage explorations** → Homepage Layout tab
- **Secondary/in-app page explorations** → Secondary Page tab
- **Component explorations** → Respective component tabs

## Design Reference System

### Using Existing Styles as References

When a style (e.g., Style G) is used as a reference:
1. **Preserve the overall layout structure** (sidebar, content areas, input positioning)
2. **Improve the visual UI** (colors, typography, spacing, effects)
3. **Maintain the page elements** but enhance their appearance

### Using Image References

When an image reference (e.g., image #7) is provided:
1. Extract the **color palette** (background, accent, text colors)
2. Identify **visual effects** (glass, gradients, shadows, glows)
3. Note **typography style** (font weights, sizes, spacing)
4. Apply these aesthetics to BOTH homepage and secondary page explorations as appropriate

## Big Arduino App Context

### Homepage (Landing Page)
- First impression for new users
- Project selection or creation entry point
- AI input for describing project ideas
- Featured projects or tutorials

### Secondary Page (Project Workspace)
The main working interface after entering a project, typically containing:
- **Left Panel**: Component library sidebar
- **Center**: Canvas/workspace area
- **Right Panel**: AI Chat assistant

When exploring secondary page styles, reference the actual Big Arduino app structure:
- Sidebar navigation
- AI chat interface (based on Style G pattern)
- Dashboard widgets if applicable

## Style Naming Convention

- **Style A-G**: Original homepage explorations
- **Style H+**: Additional explorations (can be homepage or secondary)
- Use descriptive names in the selector (e.g., "Dark Dashboard", "Lime Accent")

## Color Themes Explored

| Theme | Primary BG | Accent | Use Case |
|-------|-----------|--------|----------|
| Light Bento | #f0f0f5 | #6366f1 | Professional, clean |
| Warm Playful | #fef6e4 | #f49d6e | Friendly, approachable |
| Dark Gradient | #1a1a2e | gradients | Modern, immersive |
| Dark Lime | #0a0a0a | #9EFF00 | Tech-forward, striking |

## Implementation Notes

1. Each style should be **self-contained** with its own CSS class prefix (`.style-a`, `.style-h`, etc.)
2. Use **CSS custom properties** for easy theme adjustments
3. Include **hover states** and **transitions** for interactive feel
4. Keep styles **isolated** - changes to one style shouldn't affect others

## File Structure

```
tools/style-playground/
├── src/
│   ├── App.tsx              # Tab navigation
│   ├── App.css              # Shell styles
│   └── tabs/
│       ├── HomepageLayout.tsx    # Homepage style explorations
│       ├── HomepageLayout.css
│       ├── SecondaryPage.tsx     # Secondary page explorations
│       ├── SecondaryPage.css
│       ├── CardStyles.tsx
│       └── ButtonStyles.tsx
├── STYLE_RULES.md           # This file
└── package.json
```

## Quick Reference Commands

```bash
# Start the style playground
cd tools/style-playground && npm run dev

# View at http://localhost:5200
```
