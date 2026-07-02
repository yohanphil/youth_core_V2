Youth Central - Motion Multi Page Rebuild

What changed
- Converted the old single-file dashboard into separate pages under /pages.
- Added shared motion UI in assets/css/youth-central.css.
- Added shared Firebase-powered logic in assets/js/youth-central.js.
- Kept the original Firebase project configuration connected to youth-tasks.
- Kept existing asset folders, FOMO intro video, FOMO logo and Youth Central logo.
- Added public live scoreboard at /fomo-live.html.

Main pages
- index.html - Home dashboard
- pages/profile.html - My Profile
- pages/people.html - People database
- pages/newcomers.html - Newcomer quick capture
- pages/events.html - Special events
- pages/sundays.html - Sunday service generator
- pages/attendance.html - Attendance marking
- pages/teams.html - Teams and cell groups
- pages/followups.html - Follow-up care list
- pages/tasks.html - Kanban task board
- pages/reports.html - Reports and CSV exports
- pages/access.html - Admin access and JSON import
- pages/fomo-gameplan.html - FOMO tournament control
- fomo-live.html - Public live FOMO scoreboard

Deploy to GitHub Pages
1. Replace the files in the GitHub repository with the files inside this ZIP.
2. Keep the folder structure exactly as it is.
3. Commit and push to GitHub.
4. GitHub Pages will open from index.html.

Firebase note
The Firebase config is already linked in assets/js/youth-central.js. If you change Firebase rules, keep read/write permissions aligned with your login requirements.
