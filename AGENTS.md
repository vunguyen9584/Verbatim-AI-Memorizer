# AGENTS.md - Verbatim AI Memorizer

## Build Commands
- `npm run dev` - Start development server (Vite, port 3000)
- `npm run build` - Production build
- `npm run preview` - Preview production build

## Architecture
React 19 + TypeScript + Vite app with Gemini AI integration. Four learning modes: Quiz, Play, Co-Play, Memory Tips. Components in `/components`, services in `/services`, utils in `/utils`.

## Code Style
- **Components**: Functional React with hooks, PascalCase naming
- **Types**: Strict TypeScript, interfaces in `types.ts`, enums for constants
- **Imports**: ES6+ relative imports, group React/external then internal
- **Naming**: camelCase for vars/functions, PascalCase for components/types
- **Error Handling**: Try/catch with user-friendly messages, detailed logging
- **Styling**: Tailwind CSS classes, responsive design with flexbox/grid
- **Async**: Async/await for API calls, proper error propagation
