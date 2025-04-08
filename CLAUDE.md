# CLAUDE.md - Development Guide

## Project Commands
- Build: `npm run build`
- Development: `npm run dev`
- Lint: `npm run lint`
- Test (all): `npm test`
- Test specific file: `npm test -- path/to/file.test.ts`
- Test watch mode: `npm run test:watch`
- Test coverage: `npm run test:coverage`

## Code Style Guidelines
- TypeScript with strict typing - avoid `any` when possible
- IMPORTANT: Use relative paths for imports, NOT path aliases: 
  - Correct: `import { logger } from '../../config/logger';`
  - Incorrect: `import { logger } from '@/config/logger';`
- Import order: external libraries first, then internal modules
- Unused parameters prefixed with underscore: `function foo(_unused: string)`
- Use async/await for asynchronous operations
- Model-View-Controller pattern for API endpoints
- Services for business logic implementation
- Error handling: Use custom error classes with errorHandler middleware
- Use logger from config instead of console.log

## TypeScript Error Handling Tips
- Always specify the error type in catch blocks: `catch (error: any) { ... }`
- For "Property does not exist on type 'never'" errors in functions like useEffect cleanups:
  - Use explicit type assertions: `if (socket && (socket as WebSocket).readyState === WebSocket.OPEN)`
  - This is particularly important for variables that TypeScript might not correctly track through closures
- For event handlers, explicitly type the event parameter: `(event: React.ChangeEvent<HTMLInputElement>)`
- When using generics with React useState, always provide explicit type: `useState<Record<string, VideoStatus>>({})`

## Project Structure
- `src/api/` - Controllers, routes, middlewares
- `src/config/` - Environment variables, logging
- `src/db/` - Database models and migrations
- `src/services/` - Business logic
- `src/types/` - TypeScript type definitions
- `src/utils/` - Helper functions