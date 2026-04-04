# Submission

## Short Description
Generate admin from server folder: bun src/db/seed-admin.ts

Added new .tsx files in client/src/routes/auth:

profile.tsx – Displays user profile information, stats, and navigation to active and resolved bets.

active_bets.tsx – Shows all the user’s currently active bets.

resolved_bets.tsx – Lists all resolved bets with detailed payout, profit, and result indicators.

resolveBet.$marketId.tsx – Admin interface to resolve a specific market by selecting the winning outcome.

rankings.tsx – Displays a paginated leaderboard of users sorted by wins, showing rank, username, and total wins.

Added SSE (server sent event) for live updates;

Pagination:
Handling pagination was tricky, especially keeping data consistent across pages and ensuring smooth navigation.

I tried to implement a new route similar to to: "/auth/login" to better structure and organize the code, but I wasn’t able to make it work. For now, I decided to keep everything inside the /auth folder.
## Images or Video Demo
Private youtube video:
https://youtu.be/E3XSX9zpDsQ
