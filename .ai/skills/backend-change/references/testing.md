# DebtFlow test requests

Read `.ai/core/testing.md` for the portable workflow and
`docs/guides/backend-rules/testing-completion.md` for DebtFlow's behavioral requirements.

Placement is owned by `docs/guides/backend-rules/ownership-naming.md`: every `src` test and its
fixtures belong in the owner's `_test/` folder. Follow the owning suite when adding cases; do not
create a parallel suite beside production code. `npm run check:architecture` rejects misplaced
specs and production imports from `_test/`. `npm run typecheck` includes tests; the production build
excludes `_test/`. Select the targeted command from the project guide and build before compiled
HTTP composition tests. Do not write to the application's database.
