flowchart TD
  Start[Access Platform]
  Login[User Authentication via Supabase]
  Branch[User Role Selection]
  Admin[Administrator]
  DSOwner[Discord Server Owner]
  EndUser[End User]
  AdminDash[Admin Dashboard - Streamlit]
  AgentMgmt[Agent Management]
  Setup[Agent Configuration and API Key Management]
  DiscordConf[Discord Bot Registration and Channel Setup]
  Interaction[Agent Interaction in Discord]
  Backend[Backend API - FastAPI]
  DataStorage[Data Storage - PostgreSQL, Pinecone, GetZep]
  LLM[LLM Integration - OpenAI, Anthropic, Google Gemini, Fireworksai]
  Logging[Logging and Monitoring]
  Deployment[Digital Ocean and Supabase Deployment]
  Tools[Docker, Git, Bolt Integration]

  Start --> Login
  Login --> Branch
  Branch --> Admin
  Branch --> DSOwner
  Branch --> EndUser

  Admin --> AdminDash
  AdminDash --> AgentMgmt
  AgentMgmt --> Setup
  Setup --> Backend

  DSOwner --> DiscordConf
  DiscordConf --> Interaction
  EndUser --> Interaction

  Backend --> DataStorage
  Backend --> LLM
  Backend --> Logging
  Backend --> Deployment
  Backend --> Tools