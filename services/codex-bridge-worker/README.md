# Codex Bridge Worker

Trusted worker that runs local `codex exec` jobs for Agentopia.

The worker follows the OpenClaw-style bridge pattern:

- Agentopia stores job state in Supabase.
- The worker runs the installed Codex CLI in an allowed work directory.
- Users connect OpenAI Codex from Agentopia with `Connect Local Codex`.
- A localhost helper runs the official Codex CLI login flow on the user's machine.
- Agentopia stores Codex access, refresh, and ID tokens in Supabase Vault.
- The worker materializes a temporary per-job `CODEX_HOME\auth.json`, runs Codex, persists rotated tokens back to Vault, then deletes the temporary auth directory.

## Prerequisites

1. Install Codex CLI on the trusted runner:

```cmd
npm install -g @openai/codex
```

2. Configure Codex to use file-backed credentials if this is a headless runner:

```toml
cli_auth_credentials_store = "file"
```

Users do not run `codex login` on the runner. They run the local auth helper on their workstation, which runs the official `codex login` flow and imports the resulting file-backed auth cache into Agentopia Vault.

## Local User Connection

Run the local helper from the Agentopia repo on the workstation that has a browser:

```cmd
npm install -g @openai/codex
node services\codex-local-auth-helper\server.js
```

Then open Agentopia Credentials and click `Connect Local Codex`.

The helper listens on `http://127.0.0.1:1456`, launches official Codex login, and uses a helper-owned Codex home:

```cmd
%USERPROFILE%\.agentopia\codex-auth
```

This keeps the helper from overwriting the user's normal `%USERPROFILE%\.codex` login. The helper writes:

```toml
cli_auth_credentials_store = "file"
```

to force file-backed credentials so Agentopia can import the local `auth.json` into Vault.

## Environment

Required:

```cmd
set SUPABASE_URL=https://your-project.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
set CODEX_BRIDGE_ALLOWED_WORKDIRS=C:\agentopia-workspaces
```

Recommended:

```cmd
set CODEX_BRIDGE_RUNNER_SECRET=shared-secret
set CODEX_BRIDGE_RUNNER_ID=codex-runner-1
set CODEX_BRIDGE_PORT=8787
set CODEX_BRIDGE_JOB_TIMEOUT_MS=1800000
```

Run:

```cmd
node services\codex-bridge-worker\server.js
```

## Agentopia Edge Function Settings

Configure the Edge Function environment:

```cmd
CODEX_BRIDGE_RUNNER_URL=http://runner-host:8787
CODEX_BRIDGE_RUNNER_SECRET=shared-secret
CODEX_BRIDGE_TOOLS_ENABLED=true
CODEX_BRIDGE_DEFAULT_WORKDIR=C:\agentopia-workspaces\default
CODEX_OAUTH_CLIENT_ID=app_EMoamEEZ73f0CkXaXp7hrann
```

`CODEX_BRIDGE_TOOLS_ENABLED=true` allows agents with `metadata.settings.codex_bridge_enabled=true` to receive Codex tools, but tools are only exposed when the user has an active `openai-codex` OAuth credential.

The previous pasted-callback OAuth flow remains available in the Edge Function for diagnostics, but the primary supported path is the local helper because OpenAI's token exchange is expected to happen through the official local Codex CLI flow.

## Tools

Agentopia exposes:

- `codex_dispatch_task`
- `codex_get_status`
- `codex_answer_question`
- `codex_get_result`
- `codex_cancel_task`

For scheduled tasks, include `codex_dispatch_task` in `selected_tools` or set:

```json
{
  "codex_bridge": {
    "enabled": true,
    "workdir": "C:\\agentopia-workspaces\\project",
    "approval_policy": "manual"
  }
}
```

Queued jobs without a `credential_id` or resolvable active Codex OAuth connection fail with `Codex OAuth connection required`.

## Secret Handling

The worker reads token secrets with the service role, writes them to a temporary per-job `CODEX_HOME`, and removes that directory after the run. Set `CODEX_BRIDGE_KEEP_TEMP_AUTH=true` only for local debugging, and never commit or share temporary `auth.json` contents.

The local helper's `%USERPROFILE%\.agentopia\codex-auth\auth.json` also contains bearer credentials. Treat it like a password.

## Clarifying Questions

The worker asks Codex to emit:

```text
[[CODEX_BRIDGE_QUESTION: your question]]
```

When detected, the job becomes `waiting_for_answer`. Send an answer with `codex_answer_question`; the worker requeues and resumes the job.
