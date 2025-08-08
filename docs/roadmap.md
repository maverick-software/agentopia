
Memory System:

Our agents should have a short term memory that tracks a maximum amount of chat messages set by the user (up to a maximum of 0-100). Then, each chat should have an optional area for episodic memory, which pulls from a vector database (in our case pinecone, but needs to be remain flexible for future options) and semantic understanding through a knowledge graph (in our case GetZep, but needs to remain flexible for future options).

These additional memory types should, whenever activated and assigned, be storing user messages properly, building on episodic and semantic memory which each iterative conversation, up to a maximum storage limit that is set by the user plan and managed by the platform admins through the administration pages.

## Memory ##

Change 'Knowledge' to 'Memory.' We will work inside different types of memory: episodic, semantic, working memory. All memory types will be optional and adjustable within the users pop up modal.

## Deep Memory Search as a Tool ##

We will provide every chat respone with a predefined set of memory settings,  but if we need a deeper memory search, like expanding upon topics to find new nodes and edges, or to lower the similarity score on episodic memory to bring in more old memories, or to expand the temporal aspect of a memory to bring in memories closer to a timeline event, we can provide these tools to the agent wihin a 'Deep Memory Search' framework, where it determines if it needs to activate the Deep Memory Search state, and then determines which type of deep memory searches it wants to complete, and then calls those memory searches like MCP tools.

## Optional Chat Features ##

Let's review our system and map a methodology for toggling certain features on, like 'advanced reasoning' 'tools'



## New User Workflows ##

Let's create a workflow for new users or users who do not have an idea of what to do. Maybe we can create a support agent that helps them generate ideas for what types of agents they should create based on what they are trying to do. Are they trying to increase productivity in their business? Are they trying to accomplish a specific goal? etc.

Voice and Speech Capabilities:

We need to add voice and speech capabilities to the agents. Integrate OpenAI streaming API, OpenAI voice (if there is an API for this) as well as Elevenlabs voices. Add the API key information to the admin settings area, as we will use this sitewide. The API keys should be stored in the vault, encrypted the same as other API keys. Then, add the capability to enable voice chat to the agent page.

Add the ability to record voice and have it transcribed into text for the agent as well, independent of voice chat.

## Centaralized LLM Calls and Model Selection ##
We need to  create a centralized LLM API request system so we are not statically writing the model into functions. Our chat functions throughout code should be flexible and based on classes, and the API calls we make should be centralized and based on which model is currently set for the model variable. 

This will allow us to add a model selection to the admin settings/setup area, without breaking the entire application.


1. A memory based system that reviews and analyzes chat history (maybe a certain number of previous chats for every new message), reviews the knowledge graph data associated, and comes up with value statements that help it towards its end goal. We should probably give each agent its primary imperative, so it has an end goal that it views every request through. We will create a 'values' area in the JSON chat structure,, and we will provide a 'priority of consideration' mechanism within the chat so it knows where to focus its attention.

2. We will give users an area where they can add rules just like Cursor, and they can manage memories just like in Cursor. 

3. Managed episodic memories. We do not want every message to be saved in the vector database, as that would be overwhelming systems. What we need to do is creating a scoring system, and have a background process that investigates the existing vector memories. If there are highly relevant existing memories, then we should discard the most recent (maybe above a threshold percentage). This way we can keep the agentic experience refined to what is most useful to the user and avoid trying to create an AGI/ASI experience at this stage.

4. Public Accessibility - I would like to create an API interface where agents can be accessed by outside systems like an app using authentication, etc.

---

## Planned: Human-Reasoning Markov CoT Processor

- Add automatic chain-of-thought processor with inductive/abductive/deductive styles
- Score message complexity; select style; run dynamic Markov chain (analyze→hypothesize→test/tool→observe→update→conclude)
- Integrate RAOR loop for tools without blocking tool usage
- Persist safe reasoning summaries in responses; show in Process modal
- Feature-flagged rollout with thresholds and budgets
