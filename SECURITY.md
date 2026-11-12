# Security

Shoal can type into terminals that run Claude Code, so anything able to drive Shoal can run commands as you. The design keeps that power inside the Shoal window:

- The local server listens on `127.0.0.1` only.
- Every request needs a random 192-bit token stored in the data folder (mode 600). The token is handed to the Shoal window by the app itself (Electron preload) and is never embedded in a page or served over HTTP.
- Requests whose `Host` is not `127.0.0.1:<port>` / `localhost:<port>` are rejected (DNS rebinding), and WebSocket connections must also come from the Shoal origin.
- The page runs with a strict Content Security Policy (no inline scripts), context isolation, a sandboxed renderer and no Node.js access. Text produced by models (titles, tasks, status lines) is always escaped.
- The data folder is readable by your user only.

Known limits: processes started inside a Shoal conversation (anything Claude runs) can read the token from their environment. They already run with your permissions, so this gives them nothing more than they have.

## Reporting a vulnerability

Please open a private security advisory on GitHub ("Security" tab → "Report a vulnerability") rather than a public issue.
