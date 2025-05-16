# Implementation plan

## Phase 1: Environment Setup

1. **Prevalidation:** Check if the current directory is already an initialized project. If not, initialize a new Git repository (Reference: Project Overview, Next Steps).
2. **Tool Validation:** Verify installation of Python (3.11+) and Docker. Run `python --version` and `docker --version` to ensure compliance (Reference: Technical Stack).
3. **Directory Structure:** Create project directories:
   - `/backend` for FastAPI server code
   - `/frontend` for Next.js UI code
   - Optionally, `/infra` for deployment configurations (Reference: Technical Stack, Next Steps).
4. **MCP Integration Setup (Cursor):**
   - Check if a `.cursor` directory exists at the project root. If not, create it.
   - Within `.cursor`, create or open the file `mcp.json`.
   - Add the following configuration for macOS:
     ```json
     { "mcpServers": { "supabase": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-postgres", "<connection-string>"] } } }
     ```
     or for Windows:
     ```json
     { "mcpServers": { "supabase": { "command": "cmd", "args": ["/c", "npx", "-y", "@modelcontextprotocol/server-postgres", "<connection-string>"] } } }
     ```
   - Display this link to obtain the connection string: [Supabase MCP Setup Link](https://supabase.com/docs/guides/getting-started/mcp#connect-to-supabase-using-mcp) (Reference: Environment Setup Instructions).
   - **Validation:** After providing the connection string, navigate to Settings/MCP in Cursor and verify a green active status.
5. **Repository Initialization:** If using Bolt for project setup, instruct team members to visit the starter kit repository and click "Use Template" if not already started (Reference: Next Steps).

## Phase 2: Frontend Development

6. **Next.js Setup:** Initialize a Next.js project in the `/frontend` directory. Use `npx create-next-app@latest frontend`.
7. **UI Theme Implementation:** Configure Next.js to use a dark theme and set the font to Poppins. This typically involves setting up a theme provider (e.g., using styled-components or Tailwind CSS configuration) and applying global styles. Define base theme settings in `/frontend/styles/theme.ts` or equivalent CSS/Tailwind config.
8. **Admin Dashboard Components:** Develop the initial admin dashboard interface using React components. Create key elements to manage agents and view logs in `/frontend/components/Dashboard.tsx` (Reference: Key Features, Phase 6: UI Development).
9. **Login Interface:** Build a login form component in Next.js that connects with Supabase authentication. Create `/frontend/components/LoginForm.tsx` and integrate input fields for email and password with proper validation using React state management (Reference: User Personas & Workflows, Authentication).
10. **Validation:** Run the Next.js development server locally using `npm run dev` (or `yarn dev`) to test UI components and theme consistency (Reference: Phase 2 Milestones).

## Phase 3: Backend Development

11. **FastAPI Setup:** Initialize a FastAPI project in the `/backend` directory. Create a main file named `main.py`.
12. **API Server Initialization:** Set up the main FastAPI server instance, including CORS middleware configuration for requests from the frontend (Reference: Key Features, Backend).
13. **Logging Middleware:** Add comprehensive logging middleware in the FastAPI application to track all incoming requests and errors. Place this logic in `/backend/middleware/logging.py` (Reference: Key Features, Logging).
14. **Supabase Authentication Integration:** Create API endpoints for user authentication that interface with Supabase as the auth server. Develop these endpoints in `/backend/routes/auth.py` (Reference: User Personas & Workflows, Authentication).
15. **Database Connection:** Configure database connectivity to PostgreSQL (with pgvector) hosted on Supabase. Add configuration in `/backend/config.py` using environment variables. Provide instructions to obtain the connection string using the same Supabase MCP setup from Phase 1 (Reference: Technical Stack, Key Features).
16. **Database Schema Setup:** Design and create PostgreSQL tables for:
    - Users (with Supabase auth integration)
    - Agents
    - Personality Templates
    - Agent Logs
    This SQL schema should reside in `/backend/db/schema.sql` (Reference: Key Features, Database storage).
17. **Agent Management Endpoints:** Develop REST endpoints for agent creation, configuration, and management. Create these in `/backend/routes/agents.py` (Reference: Key Features, Phase 2: Agent System Development).
18. **Discord Integration Endpoint:** Create an endpoint to handle incoming Discord events and pass messages to agents. Place this in `/backend/routes/discord.py` (Reference: Key Features, Discord Integration, Phase 3).
19. **LLM Interface Endpoints:** Stub endpoints to interface with multiple LLM providers (OpenAI, Anthropic, Google Gemini, Fireworks.ai) in `/backend/routes/llm.py`. Ensure API keys are managed securely via environment variables (Reference: Key Features, LLM Integration, Security).
20. **Validation:** Run the FastAPI server locally using `uvicorn main:app --reload` and test the major endpoints with a tool like Postman or cURL (Reference: Phase 3 Milestones).

## Phase 4: Integration

21. **Frontend-Backend Connection:** Integrate the Next.js frontend with the FastAPI backend by setting API calls from the UI to the authentication and agent management endpoints. Update endpoints in `/frontend/services/api.ts` (or similar) (Reference: Phase 4 Integration).
22. **Discord Bot Setup:** Configure the Discord bot with webhook endpoints pointing to the `/backend/routes/discord.py`. Make sure the bot is registered with Discord and using secure tokens (Reference: Key Features, Discord Integration).
23. **LLM Provider Integration:** Wire up configuration settings for each LLM provider in the backend. Securely load API keys from environment variables and ensure endpoints use these keys when forwarding requests (Reference: Key Features, LLM Integration).
24. **Validation:** Trigger a simulated Discord event and confirm the backend logs the message correctly and the corresponding agent response is generated (Reference: Phase 4 Milestones).

## Phase 5: Deployment

25. **Docker Configuration:** Create Dockerfiles for both backend and frontend. For the FastAPI backend, create `/backend/Dockerfile` with appropriate Python 3.11 base image; for Next.js in `/frontend/Dockerfile`, use a compatible Node.js base image (Reference: DevOps, Technical Stack).
26. **Digital Ocean Setup:** Prepare deployment scripts for Digital Ocean. Ensure the frontend and key backend services are configured to deploy on Digital Ocean droplets. Document the steps in `/infra/do-deploy.md` (Reference: Key Features, Deployment).
27. **CI/CD Pipeline:** Set up a CI/CD workflow (using GitHub Actions or similar) to automatically build and deploy containers upon commit. Place configuration in `.github/workflows/deploy.yml` (Reference: DevOps, Deployment).
28. **Supabase Integration Validation:** Re-run the MCP configuration check by verifying the connection status in the MCP settings within Cursor (Reference: Phase 1, MCP Integration).
29. **Final Validation:** Conduct an end-to-end test by deploying a staging environment and performing comprehensive testing including authentication, agent management, Discord integration, and LLM API connectivity (Reference: Phase 7: Testing & Optimization).

## Phase 6: Post-Deployment Testing & Optimization

30. **Comprehensive Logging Verification:** Validate that all logs from API requests, Discord interactions, and agent responses are being recorded and monitored. Check logs in your centralized logging dashboard (Reference: Key Features, Logging).
31. **Performance Testing:** Run load tests against the backend to ensure performance under high traffic. Use a tool like Apache JMeter and document results in `/infra/load-test-report.md` (Reference: Phase 7: Testing & Optimization).
32. **Security Audit:** Perform a security review of API endpoints and database configurations, ensuring encryption and secure API key management practices (Reference: Key Features, Security).
33. **User Acceptance Testing:** Coordinate with technical administrators and Discord server owners to test the complete workflow of agent management to Discord agent responses (Reference: User Personas & Workflows).
34. **Optimization:** Based on testing feedback, optimize code and configurations to improve response times and scalability. Document optimizations applied (Reference: Phase 7: Testing & Optimization).

## Additional Considerations

35. **Error Handling:** Integrate global exception handlers in FastAPI to catch and log unexpected errors. Place handlers in `/backend/middleware/error_handler.py` (Reference: Key Features, Error Handling).
36. **Retry Logic:** For critical operations such as LLM API calls, implement retry logic (e.g., 3 attempts with exponential backoff). Update the service in `/backend/services/llm_client.py` (Reference: Q&A: Error Handling).
37. **Environment Variables:** Create a `.env` file at the project root to manage sensitive data (API keys, DB connection strings) and ensure it is added to `.gitignore` (Reference: Key Requirements, Security).
38. **Documentation:** Maintain updated documentation for the API, user workflows, and deployment processes. Store documentation in the `/docs` directory (Reference: Project Overview, Next Steps).

*Note: Throughout the implementation plan, always prevalidate each step by checking the current state of the project directory to avoid redundant setups. Each step is based on strict references from the provided project summary and technical specifications.*