# Shopify Browser - Development Guide

## Commands
- **Start development server**: `npm run dev` (serves frontend files locally)
- **Firebase commands**:
  - Local emulation: `firebase serve` or `firebase emulators:start --only functions`
  - Deploy: `firebase deploy`
  - View logs: `firebase functions:log`
- **Functions development**: `cd functions && npm run serve`

## Code Style Guidelines
- **Formatting**: 2-space indentation, semicolons required
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Error Handling**: Use try/catch blocks with specific error messages
- **Logging**: Use console.log/error with descriptive prefixes for context
- **Imports**: Group imports by type (core modules, then external packages, then local)
- **Async/Await**: Prefer over Promise chains for readability
- **Comments**: Use JSDoc style for function documentation
- **DOM Manipulation**: Cache DOM references, use event delegation where appropriate
- **Performance**: Avoid excessive DOM operations, implement pagination for large datasets
- **Accessibility**: Ensure UI elements have proper ARIA attributes and keyboard support