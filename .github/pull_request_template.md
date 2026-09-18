## Summary

<!-- What changes and why. -->

## Requirements / acceptance IDs

<!-- e.g. C6, H4. Tests covering them carry the tag in their title. -->

## Checks run

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run test:e2e` (renderer, components, runtime, graphics or QA changes)
- [ ] `npx tsx scripts/gen-schemas.ts --check` (schema changes)
- [ ] `npx tsx scripts/gen-demo-fixtures.ts --check` (agent-facing schema or stage handler changes)

## Architecture

- [ ] No agent-CLI knowledge outside `src/harness/`; no `child_process` outside `src/core/proc.ts`
- [ ] Routing changes are in `config/` / `src/routing`, not prompts
- [ ] Docs updated; deviations recorded as an ADR in `docs/adr/`
- [ ] New dependencies listed in `THIRD-PARTY.md` with licence
- [ ] No secrets, tokens, personal paths or real learner data (including fixtures)
