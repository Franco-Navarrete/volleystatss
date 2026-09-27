# Architecture decisions

- Coach access is modeled through `team_coaches`; team ownership remains unchanged so one user can coach multiple assigned teams safely.
- Public player enrollment uses revocable UUID tokens and validated database RPCs; public clients never receive team or user identifiers beyond safe team branding.
