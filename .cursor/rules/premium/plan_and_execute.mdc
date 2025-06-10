---
description: 
globs: 
alwaysApply: false
---
When this protocol is tagged, you are to:

**STEP 1: STEP PHASE** 

1. Acknowledge Constraints (bottom of file), then create the following directories:

  a) `\docs\plans\plan_name\`
  b) `\docs\plans\plan_name\research\`
  c) `\docs\plans\plan_name\implementation\`
  d) `\docs\plans\plan_name\backups\`
  e) `\docs\logs\cleanup\plan_name\`

**STEP 2: RESEARCH PHASE**

1. Research the topic, create a plan for implementation. 

   a) you are to research both the codebase (i.e. grep, listdir), the README.md and the web through this process.
   b) you are to research the sql schema for the existing database via the dump file. Make sure it is up to date first.

**STEP 3(a): PLANNING PHASE** 

   a) you are to create a proposed file structure for this plan.
   b) you document this place in `\docs\plans\plan_name\plan.md`. If the folder does not exist, create it.
   c) If you have to create files, ensure your planned file structure accounts for files between 200 to 300 lines maximum. 

**STEP 3(b): WORK BREAKDOWN STRUCTURE** 

  Create develop a Work Breakdown Structure (WBS) checklist for this plan. This WBS should follow the standard phases of a project, which are `research`, `planning`, `design`, `development`, `testing` and `refinement`. 

**STEP 3(c): PLAN REVIEW AND REFINEMENT**

  You are to go to line by line on the WBS and`research each individual task` based on the rules below.

  *IMPORTANT*  You never start any coding or changes before you research each item on the checklist.

**STEP 3(c)(1): REVIEW AND RESEARCH**

  a) for each line, you are to refer to the README, SQL Database Dump and relevant files to ensure you are in alignment with the existing codebase and technology. You build these steps into your WBS checklist steps so you never forget.

  b) You are to document dependencies, associated files in the codecase, perform web research if necessary, and finally draft a mini plan plan for the WBS checklist item you are referencing. These research documents can include the code you plan to implement as well as the contextual references like information and web links, etc.

**STEP 3(c)(2): DOCUMENT RESAERCH**

  a) Each time you return with your research, you create a reference file in the plan folder under `\docs\plans\plan_name\research\[files]` and make a reference to the file in the **wbs_checklist.md** as a subitem to the checklist item. You are to assume that after you perform your research on a specific task and document it, you will forget everything you researched, so your notes should be superfluous, providing every bit of context you can give yourself or a future developer about your thoughts and reasoning for that step.

  b) You are to add instructions to each research document to backup files before changing them in `\docs\plans\plan_name\backups`. Then, after completion and review of the wbs_checklist, you will delete this folder, so that should be the last item on the checklist under 'Clean up'.

  c) You then update the WBS checklist item. The bullet points under each wbs checklist item should look like:
    **REQUIRED READING BEFORE STARTING: [file_path_to_research_document]**,
    **Plan Review & Alignment: [notes]**,
    **Future Intent: [notes]**,
    **Cautionary Notes: [notes_for_future_self]**,
    **Backups: [file_locations]**

**PHASE 5: IMPLEMENTATION PHASE** 

  a) Now that your research and mini plans are complete, you are to begin implementing the modifications and updates to the codebase. Continue to follow the rules provided you, always using the `big_picture_protocol.mdc` and `troubleshooting.mdc` if you get stuck in a fix, or hit your three try limit.

  b) After the completion of each task, update the WBS Checklist after implementation with copius notes:

  **Actions Taken: [methods_and_modifications] `e.g. /odcs/plans/plan_name/implementation/2.2.5_implementation_notes.md`**
  **Reversal Instructions: [file_name] `e.g. /odcs/plans/plan_name/implementation/2.2.5_reversal_instructions.md`**
  **Update: [any_updates_that_happen_after_completion_during_review_revise]**


**PHASE 6** It is time to cleanup. This should be the last phase in  your WBS checklist. After you review constraints below:
 
  a) Prompt the user to check for any console errors, and to review functionality of the new system. Give them a few items to test to ensure everything is working well. 
  b) Once the user confirms the repair, new feature or functionality is working, then move the backups folder to the `/archive` folder in root. If it doesn't exist, create it.  
  c) Ensure the archive folder is listed in .gitignore.
  d) Update the README.md in the root folder with all relevant project details.
  e) Provide the user with a summary of the project and the steps complete
  f) For your cleanup logs in `/docs/logs/cleanup/[plan_name]/` you are to create a new cleanup for the complete implementation, and then you are to update the README.md in `/docs/logs/` cleanup table to reference the implementation and cleanup file name and location.

**CONSTRAINTS:**

  1) You NEVER remove/delete steps or summarize them in a WBS.
  2) Leave comprehensive notes in your checklist. Assume you will forget everything and will need your wbs checklist and notes to succeed.
  3) Always update your WBS along the way, ensuring you leave completion notes under the checklist item when you mark it complete. This way a developer can return back and know what happened.
  4) If you update a major part of the application, append the README.md in the root directory with the new information.