# Architecture & Constraints

## View Standalone (Legacy Support)
- **Decoupling**: The files in `public/view/` are standalone and must remain decoupled from `public/app.js` and `public/style.css`.
- **WebSocket Protocol**: The WebSocket server must NOT be explicitly adapted for the "Pro View". 
- **Client-Side Responsibility**: The View must be able to consume the same generic data streams as the main application. Any filtering, scaling, or specialized rendering for legacy devices must happen exclusively on the client side (in `view.js` / `view.css`).

## Commit Guidelines
- Commit messages must follow a strict structure: **`[version][scope][parameter]`**
- **Scopes**: `proview` or `protouch`
- **Example**: `v0.1mon proview mute-test`

## Compatibility Strategy
- **Pro Touch (`public/app.js`)**: Modern environment. Use modern JS syntax (Spread, etc.). No legacy constraints.
- **Pro View (`public/view/`)**: Legacy environment (iOS 12). Avoid modern syntax (Spread, Template Literals if needed, etc.) to ensure operation on old hardware.
- **Server (`server.js`)**: Agnostic bridge. Handles messages from both environments without requiring specific adaptations for one or the other.
