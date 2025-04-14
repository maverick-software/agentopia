# Agentopia - Discord Bot Integration

This project integrates Agentopia agents with Discord, allowing them to be activated and interact within Discord servers.

## Project Structure

```
.
├── .cursor/              # Cursor AI configuration/rules
├── .git/                 # Git repository data
├── .bolt/                # Bolt specific config (if used)
├── discord-gateway-client/ # (Likely) Client for direct Discord Gateway interaction
├── docs/                 # Project documentation
├── node_modules/         # Node.js dependencies
├── scripts/              # Utility scripts
├── services/             # Backend microservices
│   ├── discord-worker/   # Node.js service that connects to Discord as a bot
│   └── worker-manager/   # Node.js service to manage/launch discord-worker instances
├── src/                  # Frontend source code (React/Vite)
│   ├── components/       # Reusable UI components
│   ├── contexts/         # React contexts (e.g., Auth)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Library initializations (e.g., Supabase)
│   ├── pages/            # Page components (e.g., AgentEdit)
│   └── types.ts          # TypeScript type definitions
├── supabase/             # Supabase specific files
│   └── functions/        # Supabase Edge Functions (interaction handler, command registration)
├── utils/                # General utility functions
├── .env                  # Root environment variables (primarily for frontend/Vite)
├── .gitignore            # Git ignore rules
├── eslint.config.js      # ESLint configuration
├── index.html            # Main HTML entry point for Vite frontend
├── package-lock.json     # NPM dependency lock file
├── package.json          # Project dependencies and scripts
├── page.tsx              # (Likely) Root frontend component or entry point
├── postcss.config.js     # PostCSS configuration (for Tailwind)
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.app.json     # TypeScript config for the frontend app
├── tsconfig.json         # Base TypeScript configuration
├── tsconfig.node.json    # TypeScript config for Node.js parts
└── vite.config.ts        # Vite build tool configuration
```

## Key Components

*   **Frontend:** React application built with Vite, using Tailwind CSS for styling. Allows users to configure agents and their Discord integration details (`src/`, `index.html`, `vite.config.ts`).
*   **Supabase Backend:** Utilizes Supabase for database storage, authentication, and Edge Functions (`supabase/`).
    *   `discord-interaction-handler`: Handles incoming webhooks from Discord (slash commands, autocomplete).
    *   `register-agent-commands`: Registers slash commands with Discord for specific bot applications.
*   **Worker Services:** Node.js services designed to run persistent bot instances (`services/`).
    *   `discord-worker`: Connects to Discord using an agent's token, handles inactivity, and processes messages.
    *   `worker-manager`: An Express server responsible for launching and managing instances of the `discord-worker`.

*(This is a basic structure inferred from file names and conversation context. Needs further refinement.)* 