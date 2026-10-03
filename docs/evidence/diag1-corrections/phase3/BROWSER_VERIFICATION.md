# Browser verification — local candidate

Local Vite `http://127.0.0.1:5183/`, production source in this worktree, Codex in-app browser. Initial CUA attachment wrappers timed out; direct documented browser-tab DOM access then succeeded. This was a real rendered application, not a source-string assertion.

- Initial map and selected Delta Reed Band panel render. A real Step moves the clock from day0 to day1.
- Technical → Weak-band fate displays `heuristic viability/risk score` and `0–1 heuristic; no calibrated probability or time horizon`.
- Chronicle → Reading view displays the annual-classification explanation for hunger-years, the separation from dated nutrition exposure, and no reconstruction of earlier daily history. Band overview and Chronicle remain usable.
- Map mode button displays `Ecological activity · Technical`. The visible layer explanation says `Ecological activity index from physical patches and stocks; not exact extractable food.`
- Enter on the map opens actual tile98:63. Inspector shows `Living ecology · current activity index`, `ecological activity index`, and `ecological index, not exact extractable food; residual harvest may remain at zero index`.
- Visual screenshot revealed the old canvas legend still said current support. It was corrected to ecological activity at all five levels; numerical/colors/scales unchanged. After an explicit reload, final screenshot inspection confirmed all five ecological-activity legend levels; console remained empty.
- Captured console error/warning lists were empty. No broken selected-band panel observed.

React review: four existing TSX presentation surfaces changed only text/metadata; no new effect, state, async work, handler or network dependency. Canvas legend change is literal text only. Final TypeScript projects and production build pass in `regressions/COMMANDS_FINAL.json`.
