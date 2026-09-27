# Architecture decisions

- Coach access is modeled through `team_coaches`; team ownership remains unchanged so one user can coach multiple assigned teams safely.
- Public player enrollment uses short revocable random codes backed by legacy UUID compatibility and validated database RPCs; public clients never receive team or user identifiers beyond safe team branding.
- Player birth dates are stored as dates and public registration writes only through the validated security-definer RPC.
- Invitations use team_invitations (multi-use by default, 7-day expiry) creating pending team_members + player_profiles via request_team_membership; coaches approve with review_team_membership, which links a players row so stats never duplicate. Photos are compressed data URLs because public buckets are blocked.
- Invitation signups always get the global 'player' app_role, assigned server-side in request_team_membership (team_invitations.intended_role is constrained to 'player'); admin/coach roles are only granted by admins, and users without coach signals default to the player panel.
- Admin club/user directory reads go through service_role-only SQL functions (admin_club_directory, admin_club_users, admin_user_search) called from admin-verified server functions, paginated server-side so it scales to thousands of users.
- Player careers aggregate all `players` rows sharing a `user_id` (computed server-side from app_state in player-career.server.ts); public profiles at /player/$alias exist only when player_profiles.visibility='public' and never expose birth date. Why: one permanent identity across clubs without duplicating stats.
