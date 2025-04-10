# Project Requirements Document (PRD) for Agentopia

## 1. Project Overview

Agentopia is a web platform designed to help technical administrators create, configure, and manage AI agents that integrate seamlessly with Discord. The platform addresses the need for efficient management of customized AI agents that not only interact with Discord users but also communicate with one another. By offering flexible personality templates (including preset options like DISC and Myers-Briggs as well as custom templates), data storage integration, and robust API security, Agentopia enables efficient agent configuration and interaction management, ensuring that businesses and technical teams can tailor AI behaviors for various scenarios.

The project is being built to consolidate the management of AI agents and their interactions into a single, intuitive platform. The key objectives include fast and reliable agent creation, database-driven personality and chain-of-thought management, secure API integrations with multiple LLM providers, and deep Discord integration allowing for flexible agent responses. Success for Agentopia will be measured by smooth agent deployment, comprehensive monitoring and logging, secure user authentication, and the ability to scale the system for concurrent agent operations on platforms like Digital Ocean and Supabase.

## 2. In-Scope vs. Out-of-Scope

### In-Scope

*   **User Authentication:** Secure login and user account management using Supabase.

*   **Agent and Template Management:**

    *   Creation and configuration of AI agents.
    *   Management of personality templates (preset DISC and Myers-Briggs) and Chain of Thought (CoT) templates, including the ability to create, download blank, and generate templates from descriptions.

*   **Discord Integration:**

    *   Registration and management of Discord bots.
    *   Mapping agents to specific Discord channels.
    *   Configurable agent interaction modes (respond to every message vs. respond when tagged).

*   **Backend Integrations:**

    *   REST API implementation with FastAPI.
    *   PostgreSQL (with pgvector extension) for structured data storage.
    *   Pinecone for vector-based storage and search.
    *   GetZep for graph memory functionalities.

*   **LLM Integrations:** Connection and API key management for OpenAI, Anthropic, Google Gemini, and Fireworks.ai.

*   **Frontend Development:**

    *   Admin dashboard built with Streamlit (or a compatible alternative within the Bolt ecosystem) featuring dark theme and Poppins fonts.
    *   UI components for managing agents, datastores, Discord integrations, MCP configurations, and system monitoring.

*   **Comprehensive Logging and Monitoring:** To track errors, system performance, and real-time data from PostgreSQL, Pinecone, and GetZep.

### Out-of-Scope

*   Advanced customization of front-end UI beyond the dark theme with Poppins typography.
*   Non-Discord interaction channels or alternative messaging platforms.
*   External moderator or logging interfaces for end-user conversations beyond the basic logging and error monitoring.
*   Additional user roles or permission levels beyond the Administrator, Discord Server Owner, and End User.
*   Performance benchmarks and load tests details; only basic expectations provided for reasonable response times.
*   Extended post-launch feature enhancements that may be scheduled for later phases (e.g., multilingual support, extensive analytics dashboards).

## 3. User Flow

When an Administrator accesses Agentopia, they first log in via the secure Supabase authentication system. Once logged in, they are taken to the admin dashboard where they can view an overview of existing AI agents, datastores, and integration settings. From here, the Administrator is enabled to create new agents by filling in details such as a description, choosing a personality template (or uploading a custom JSON template), and assigning relevant datastores. They can configure whether an agent should respond to every message or only when tagged, and assign specialized Chain of Thought templates to guide agent interactions. All changes and operations are logged for auditing and troubleshooting purposes.

For the Discord Server Owner and End User, the experience is streamlined for direct interaction with the agents within Discord. After a secure login—if they are also administrators or have delegated access—the Discord Server Owner uses a dedicated interface to assign agents to specific channels and manage their settings. End Users, on the other hand, interact with these agents on Discord channels where the agents respond automatically or when mentioned by an @agent_name tag. Behind the scenes, all interactions between agents and users are recorded, ensuring that administrators can later review communication logs for any necessary performance tuning or support issues.

## 4. Core Features

*   **User Authentication & Management**

    *   Secure login using Supabase.
    *   User account creation and role management.

*   **Agent Creation and Management**

    *   Creation, updating, and deletion of AI agents.
    *   Detailed configuration options, including personality assignments and interaction modes.
    *   Option to toggle agent responses (always-on vs. tag-based).

*   **Template and Chain-of-Thought (CoT) Management**

    *   Support for pre-designed personality templates (DISC and Myers-Briggs).
    *   Facility to download blank templates and generate new ones via descriptive prompts.
    *   Storage and retrieval of customized templates from a dedicated database.

*   **Discord Integration**

    *   Registration of Discord bots and API integration.
    *   Mapping of agents to specific Discord channels.
    *   Configuration options for response behavior (automatic vs. on-demand via tag).
    *   Event listeners and handlers to track and manage interactions.

*   **Backend Integrations**

    *   REST API endpoints built with FastAPI.
    *   PostgreSQL with pgvector extension integration via Supabase for structured data.
    *   Pinecone for efficient vector-based search operations.
    *   GetZep integration for graph memory management.

*   **LLM Integrations**

    *   API connections to OpenAI, Anthropic, Google Gemini, Fireworks.ai.
    *   Model selection, configuration interface, and secure API key management.

*   **Logging and Monitoring**

    *   Comprehensive logging for API calls, agent interactions, and system events.
    *   Real-time monitoring via the admin dashboard with visualizations for performance data.

*   **Frontend & Dashboard Interface**

    *   Admin dashboard built with Streamlit (or a compatible alternative).
    *   Dark themed UI utilizing Poppins font.
    *   Dedicated pages for agents, datastores, Discord, MCP, and system settings.

*   **Deployment & Environment Setup**

    *   Docker for containerization.
    *   Git for version control.
    *   Scripts for environment setup, deployment, and database initialization.

## 5. Tech Stack & Tools

*   **Frontend:**

    *   Framework: Streamlit (or a compatible alternative within Bolt.new’s ecosystem)
    *   UI Design: Dark theme with Poppins font
    *   Tools: Bolt for quick project setup with AI-powered scaffolding

*   **Backend:**

    *   Framework: FastAPI (for REST API)
    *   Language: Python 3.11+
    *   Database: PostgreSQL with pgvector extension (hosted via Supabase)
    *   Additional Storage: Pinecone (for vector storage) and GetZep (for graph memory)
    *   Discord Integration: Discord API for bot registration and interactions

*   **LLM and External AI Integrations:**

    *   Providers: OpenAI, Anthropic, Google Gemini, Fireworks.ai
    *   Security Libraries: Libraries for encryption and API key management (integrated with Supabase)

*   **DevOps and Miscellaneous:**

    *   Containerization: Docker
    *   Version Control: Git
    *   Scaffolding & Best Practices: Bolt.new ecosystem

## 6. Non-Functional Requirements

*   **Performance:**

    *   The system should handle concurrent agent operations smoothly.
    *   Vector searches and API response times should remain within acceptable limits to ensure real-time interactions.

*   **Security:**

    *   All API keys and sensitive integrations must be encrypted.
    *   Use secure protocols for authentication (managed via Supabase).
    *   Ensure compliance with basic data protection standards.

*   **Usability:**

    *   The admin dashboard must be intuitive and follow everyday UI design standards.
    *   The dark-themed UI with Poppins font should offer a consistent visual experience.

*   **Reliability:**

    *   Comprehensive error handling and extensive logging should be implemented.
    *   The system must allow for rapid error diagnosis and resolution, particularly in multi-agent environments.

*   **Scalability:**

    *   Deployment on Digital Ocean should support horizontal scaling for increasing loads.
    *   Backend must support scaling via Docker containers and database replication if necessary.

## 7. Constraints & Assumptions

*   The system relies on the availability of external services like Supabase, Pinecone, GetZep, and multiple LLM providers (OpenAI, Anthropic, Google Gemini, Fireworks.ai). Their API limits and rate restrictions must be assumed.
*   It is assumed that the Administrator role will be the primary interface for managing agents and system settings, with external users interacting only through Discord.
*   The project will initially deploy on Digital Ocean, and the frontend and parts of the backend will be hosted there.
*   Assumes that basic performance benchmarks are adequate for initial testing, with future updates to define precise load and response time standards.
*   The project assumes that the provided dark theme and Poppins font are sufficient styling guidelines, with additional design details to be refined later if necessary.
*   The AI agents’ communication and internal logging are assumed to be managed with basic but effective error-catching and overload prevention measures.

## 8. Known Issues & Potential Pitfalls

*   **API Rate Limits:**

    *   External APIs (LLM providers, Discord API) may enforce rate limits. Mitigate by implementing rate-limiting strategies and error retry mechanisms.

*   **Concurrency and Load Testing:**

    *   The system might face challenges handling multiple concurrent agent operations. Mitigate this with load testing, optimizations in FastAPI, and scaling solutions using Docker.

*   **API Key Management:**

    *   Safeguarding API keys is critical. Ensure encryption, secure storage practices, and do not expose keys in the frontend.

*   **Integration Complexity:**

    *   Multiple integrations (Discord, MCPs, various LLM providers) can introduce synchronization issues or compatibility bugs. Use comprehensive logging and thorough integration testing to detect and resolve these issues early.

*   **Monitoring and Error Handling:**

    *   Ensure that logging is sufficiently detailed to troubleshoot complex agent interactions and system performance issues, reducing the risk of overlooked edge cases.

*   **Deployment Dependencies:**

    *   The reliance on services hosted on Digital Ocean and Supabase means network or service outages may affect system availability. Prepare contingency plans and backup services if needed.

This PRD serves as the central reference document for Agentopia, outlining the key features, user workflows, technical specifications, and potential pitfalls. Subsequent documents (Tech Stack, Frontend Guidelines, Backend Structure, etc.) will be derived from this clear and comprehensive guide.
