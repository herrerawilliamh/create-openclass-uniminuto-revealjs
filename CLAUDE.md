## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## OpenClass minimal-context workflow

- At session start, read only `docs/AI-CONTEXT.md` for project context. Do not read the entire repository or all of `graphify-out/GRAPH_REPORT.md`.
- Before exploring source, use `graphify query`, `graphify explain`, or `graphify path` from the master root; both agents share `graphify-out/graph.json`. Open only necessary files identified by the graph. Forward this rule to delegated workers.
- After relevant changes, run `graphify update .` and verify the outcome before the next gate.
- ONE MUTATION -> ONE VERIFICATION -> NEXT GATE.
- Preserve all existing instructions and institutional constraints. Publishing is limited to this project's public GitHub repo, GitHub Pages and npm package with the neutral theme; never publish `recursos-institucionales/`. No sibling-repository (Slidev, openclass-prueba-reveal) changes.
