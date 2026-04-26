# Codex Local Auth Helper

Local companion service for importing official Codex CLI ChatGPT OAuth credentials into Agentopia.

Run from the Agentopia repo:

```cmd
npm install -g @openai/codex
node services\codex-local-auth-helper\server.js
```

Then open Agentopia Credentials and click `Connect Local Codex`.

The helper uses its own Codex home at:

```cmd
%USERPROFILE%\.agentopia\codex-auth
```

It writes `config.toml` with:

```toml
cli_auth_credentials_store = "file"
```

This keeps the helper from changing your normal `%USERPROFILE%\.codex` login. Treat the helper-owned `auth.json` as a secret.
