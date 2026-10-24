# Project Rules

Main priorities:

1. Architecture
2. Security
3. Performance
4. Data integrity
5. Reports correctness
6. Mobile UI

Preserve existing business logic.

If existing logic is correct, do not change it.

If a real bug is found, fix it.

Refactoring is allowed when it improves architecture, maintainability, security or performance without changing expected behavior.

Frontend, backend, API and database must operate as one consistent system.

Do not reintroduce Google Gemini API, @google/genai or OCR functionality.

Do not only report problems when they can be fixed directly

After significant changes, run relevant tests/build/typecheck
