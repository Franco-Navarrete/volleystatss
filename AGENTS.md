# Architecture decisions

- Coach access is modeled through `team_coaches`; team ownership remains unchanged so one user can coach multiple assigned teams safely.
- Public player enrollment uses short revocable random codes backed by legacy UUID compatibility and validated database RPCs; public clients never receive team or user identifiers beyond safe team branding.
- Player birth dates are stored as dates and public registration writes only through the validated security-definer RPC.
