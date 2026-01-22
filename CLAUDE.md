# Big Arduino App - Development Guidelines

## Layout Best Practices

### Full-Height Layout Rules

1. **Use `height: 100%` chain, not `min-height`**: From html -> body -> #root -> page container, use explicit `height` for child elements to inherit properly. Using `min-height` breaks the height inheritance chain.

2. **Use `height: 100vh` only at one level**: Typically on the page container (e.g., `.project-page`), with `overflow: hidden` to prevent scrollbars.

3. **Sidebar containers need `height: 100%`**: Apply height to the shell/container element, not just the inner content. The container should stretch to fill available space regardless of content height.

### Canvas/Interactive Area Rules

1. **Use ResizeObserver for canvas dimensions**: Never rely solely on `window.resize` - layout changes (panel resizers, collapsing sidebars) won't trigger window resize events.

2. **Update canvas dimensions on container resize**: Libraries like Fabric.js and p5.js need explicit dimension updates via `setDimensions()` or similar methods when the container size changes.

3. **Test interaction at all viewport regions**: Click/drag in corners and edges, not just the center. The interactive area must match the visible canvas area.

## Common Pitfalls to Avoid

- Don't use `min-height: 100vh` on multiple levels of the component hierarchy
- Don't forget `overflow: hidden` on fixed-height containers to prevent unwanted scrollbars
- Don't assume `window.resize` catches all layout changes - use ResizeObserver for containers that can resize independently

## Changelog Requirements

**All updates must be recorded in `docs/CHANGELOG.md`.**

When making changes:
1. Add a new version entry with the current date
2. Use semantic versioning:
   - **Major (X.0.0)**: Significant feature updates
   - **Minor (X.Y.0)**: Small improvements or enhancements
   - **Patch (X.Y.Z)**: Bug fixes
3. Categorize changes under: Added, Changed, Fixed, Removed
4. Write clear, concise descriptions of each change
