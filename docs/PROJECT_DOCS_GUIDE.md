# Project documentation portal

The frontend serves the Amader Krishi AI pitch and technical documentation at `/docs`. The existing FastAPI Swagger UI still lives at `/docs` on the API host. Frontend data requests use `/project-docs`.

## Competition preview

The always-available `/judge-preview` page distributes the public competition snapshot with the frontend build. The copy in `frontend/src/components/docs/judgeShowcase.json` is the material included in the competition preview. It contains no production account data or dynamic metrics. Use `/docs` to publish newer live releases through the editor.

The `/admin` sign-in form displays `mindforge-judge-demo` and `KrishiPreview2026` for the sample marketplace review workflow. Demo decisions exist in that page session and are reset on sign-out or reload. This demo does not obtain a backend staff token. Real staff must sign in with their own backend account.

## Publish a showcase

1. Sign in at the existing `/admin` portal, then open **ডকুমেন্টেশন** or go to `/docs/admin`.
2. Edit and reorder sections, add team members and portraits, and preview the draft. Use the keyboard reorder buttons when dragging is inconvenient. Turn on each contact email you want displayed in the public team directory.
3. Save the draft or select **Publish version** to publish. Published versions are listed in **Versions** and can be restored to the draft.
4. Choose **Open immediately**, **Apply schedule**, or **Open for duration**. Publishing a version uses the existing access settings. **Close immediately** blocks subsequent public API responses.
5. Open the public link in a signed-out window. Public viewers can search, copy section links, download Markdown, and choose **Save as PDF** in the browser's print dialog.

The initial schedule is June 10 at 00:00 through June 14 at 23:59, inclusive, in Asia/Dhaka. It uses the next upcoming window on first initialization, then persists the schedule in the database. For a first initialization after June 2026, this is June 2027.

## Runtime and deployment

- Deploy the backend and frontend in the same release. FastAPI creates the two documentation tables on startup. Continue using the existing `DATABASE_URL`. A persistent database keeps the schedule and publications across restarts.
- The existing Krishi Market admin accounts can edit and publish. An optional comma-separated `DOCS_SUPER_ADMINS` setting displays the **Super Admin** role for matching existing admin usernames. Both staff roles have the same publishing permissions. It does not create any accounts.
- The public API checks the schedule on every request and sends `Cache-Control: private, no-store`. The browser revalidates every 15 seconds and on focus. The public page also closes at the scheduled end without waiting for its next poll.
- The live snapshot uses the running OpenAPI catalog and registered model inventory. It reports route availability, not upstream uptime. Account, prediction and listing counts come from the application database and exclude demo accounts. Aggregate counts are public only when included in a published version.
- Public team cards are editorial records. They do not pull account emails or profile pictures from the user database. Photos are cropped to 320×320 and stored as JPEGs. Team cards show initials when no portrait is provided.
- To add a built-in feature or endpoint to the live catalog, add its actual route to `backend/app/services/docs_content.py`. Editors can add narrative sections, reorder them and maintain the roadmap without a deployment.

Run the targeted tests from the repository root.

```bash
PYTHONPATH=backend python -m pytest backend/tests/test_project_docs.py
npm --prefix frontend run build
```
