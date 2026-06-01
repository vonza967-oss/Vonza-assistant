# Agent Package Template

This folder is example-only scaffolding for future packages. It is not a registered package and must not be imported by `src/agentPackages/index.js`.

Use these files as a copy starting point:

- `manifest.example.js`: manifest shape, including role, intents, prompt blocks, risk rules, tool declarations, and knowledge policy.
- `promptBlocks.example.js`: package-owned prompt text examples.
- `tools.example.js`: metadata-only tool declarations.
- `knowledgePolicy.example.js`: report-only evidence policy examples.

Rules:

- Rename every `example_*` key before using the template.
- Keep tool keys metadata-only. They are not executable integrations.
- Keep knowledge policy `report-only` until report-only data has been reviewed.
- Add package-specific evals before registering or selling a package.
- Do not update `src/agentPackages/index.js` until the package is intentionally registered.
