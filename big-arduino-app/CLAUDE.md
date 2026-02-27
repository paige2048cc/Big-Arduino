# Big Arduino App - Development Guidelines

## Security Requirements

### API Keys and Secrets

**CRITICAL: Never commit API keys, secrets, or credentials to the repository.**

1. **Environment Variables Only**: All API keys must be read from environment variables (`process.env.*`), never hard-coded.

2. **Server-Side Only**: API keys must only be used in server-side code (`/api/*` functions). Never expose keys in frontend code.

3. **Forbidden Patterns**: Do not write code containing:
   - Hard-coded API keys (e.g., `AIza...`, `sk-...`)
   - `import.meta.env.VITE_*` for API keys (these are exposed to the client)
   - Inline credentials in fetch headers

4. **Environment Files**:
   - `.env` - Local development secrets (NEVER committed, in .gitignore)
   - `.env.example` - Template with variable names only (committed)
   - Vercel Dashboard - Production secrets

5. **Before Committing**: Always search for leaked credentials:
   ```bash
   grep -r "AIza" --include="*.ts" --include="*.tsx" --include="*.js"
   grep -r "sk-" --include="*.ts" --include="*.tsx" --include="*.js"
   ```

### Current Environment Variables

| Variable | Where to Set | Purpose |
|----------|-------------|---------|
| `GEMINI_API_KEY` | `.env` (local), Vercel Dashboard (prod) | Google Gemini AI API |

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
