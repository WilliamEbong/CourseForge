# Opus Execution Handoff

The CourseForge v1 implementation plan has been prepared in Plan Mode from the bootstrap specifications and current environment inspection.

Switch from planning to implementation now.

Re-read:

- the active implementation plan under `docs/exec-plans/active/`;
- `MASTER_BUILD_PROMPT.md`;
- the acceptance criteria in `specs/10_ACCEPTANCE_TESTS_AND_DEFINITION_OF_DONE.md`;
- any unresolved issues recorded by the planning subagents.

Then execute the plan autonomously.

Use parallel subagents/worktrees for independent workstreams with clear ownership, integrate at the planned checkpoints, run the relevant tests continuously, and repair failures before advancing.

Do not ask me to reconfirm ordinary implementation decisions already resolved by the specifications or approved plan. Preserve existing files, imported examples, and user environment. Do not rely on global plugins/skills for correct operation.

Continue until the working CourseForge system and its tests/documentation satisfy the definition of done, or until you hit a genuine external blocker requiring authentication, OS permission, or missing user-controlled access that cannot be resolved programmatically. If that occurs, leave the repository in a coherent tested state and document exactly what remains blocked and the single action needed from me.

