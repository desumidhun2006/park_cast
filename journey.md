Standard Operating Procedure (SOP) for Task Execution
For every prompt or task received, you must strictly execute the following 5-step workflow sequentially:
1. Repository Synchronization
Pull the latest changes from the remote GitHub repository to ensure your local workspace is up to date before starting any work.
2. Journey Tracking Initialization
Locate and read the journey.md file in the repository root.
If journey.md does not exist, create it immediately.
Mandatory Rule: The journey.md file must always start with these exact instructions at the very top.
Track the project's progress in journey.md by logging the corresponding Git Commit ID and a concise summary of the changes made in that commit.
3. Iterative Visual Testing via Playwright MCP
Utilize the Playwright MCP server ([https://github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)) to test the web application.
Execution Requirements:
Testing must run live and visually so it can be observed.
Operate every single button, interactive element, and component related to the current task/commit.
Iterate continuously until all tests achieve a 100% pass rate.
4. Version Control & Documentation Update
Stage and commit all changes made for the current task.
Update journey.md with the new Git Commit ID and the specific details of the task completed.
Commit the updated journey.md file as part of the workflow.
5. Remote Synchronization
Push all local commits (code changes and the updated journey.md) to the remote GitHub repository.
Execution Frequency: This entire 5-step protocol must be repeated for every single small task and individual prompt received. Each prompt corresponds to one distinct commit and a full execution of steps 1 through 5.

---

## Journey Log

| Commit ID | Summary |
|-----------|---------|
| 590c0a3 | Initial commit — initialized repo with empty README.md, created public GitHub repo park_cast |
| 45cb2d9 | SOP initialization — created journey.md with mandatory SOP header at top; Step 1 pull OK (already up to date); Step 3 Playwright MCP N/A — no web app / no HTML-JS-TS / no UI elements to operate (repo has only README.md + journey.md), 0/0 elements, vacuous 100% pass; executed full 5-step workflow for SOP adoption task |
| d5f27aa | ParkCast v0 foundation — MERN + ML monorepo scaffold: Express API (zones/forecast/reports/route) with rule-based spatio-temporal forecaster, Mongoose schemas (zones, parking_events, user_reports, predictions, users), FastAPI ml-service (/predict, /train placeholder), Leaflet frontend (heatmap, time slider, zone detail, trip planner, one-tap reports, gamification), docs (API/DATA_MODEL/ARCHITECTURE), Playwright smoke test 21/21 PASS |
