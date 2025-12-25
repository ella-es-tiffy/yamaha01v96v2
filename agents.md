## Modules & Versioning
The project is split into three core modules, each maintaining its own versioning (synchronized in file headers and commit messages):

- **Module: Pro Touch (`public/app.js`)**
  - **Environment**: Modern JS (Spread syntax, ES6+).
  - **Role**: Primary user interface for modern devices.
- **Module: Pro View (`public/view/`)**
  - **Environment**: Legacy JS (iOS 12 compatible).
  - **Role**: Lightweight monitoring/control for old hardware.
  - **Constraint**: Must remain fully decoupled from Pro Touch.
- **Module: Server (`server.js`)**
  - **Role**: Agnostic bridge & Translation layer.
  - **Logic**: Handles communication between Mixer, Pro Touch, and Pro View, including dialect translation.

## Commit Guidelines
- Commit messages must follow a strict structure: **`[version][module][parameter]`**
- **Modules**: `protouch`, `proview`, `server`
- **Example**: `[v0.1.1-mon][proview][fix-sync]`

## Compatibility Strategy
- **Pro Touch**: No legacy constraints. Use standard modern practices.
- **Pro View**: Legacy-first. Avoid syntax that breaks Safari 12.
- **Server**: Handles translation between modern and legacy dialects.

## Coding Standards
- **No Procedural JS**: Completely avoid procedural JavaScript. Use Object-Oriented (Classes), Functional, or Modular patterns. Logic must be encapsulated.
- **CSS Structure**: Subdivide CSS into clear sections for Modules and Functions (e.g., using comments to delineate Layout, Components, Specific Views). Avoid monolithic blocks without clear grouping.
- **Type Safety**: Where possible without full TypeScript, use clear naming and object structures to maintain predictability.

## Agent Role & Critical Feedback
- **Role**: You act as a Senior Programmer and Lead Architect.
- **Critical Feedback**: If a decision or architectural direction suggested by the USER is technically unsound, short-sighted, or creates unnecessary complexity ("tech debt"), you MUST proactively point it out.
- **Objective**: Prioritize technical excellence, project stability, and long-term maintainability over "quick and dirty" wins. Do not just follow orders; provide expert guidance.
