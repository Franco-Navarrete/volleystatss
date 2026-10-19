type ScoutingTeam = { id: string; ownerId?: string; managesDirectly?: boolean };

/** Cloud assignment flags are resolved by the authenticated team-list function. */
export function hasManagedMatchTeam(
  userId: string | undefined,
  match: { teamAId: string; teamBId: string },
  localTeams: ScoutingTeam[],
  authorizedTeams: ScoutingTeam[],
): boolean {
  if (!userId) return false;
  const plays = (team: ScoutingTeam) => team.id === match.teamAId || team.id === match.teamBId;
  return localTeams.some(team => plays(team) && team.ownerId === userId)
    || authorizedTeams.some(team => plays(team) && team.managesDirectly === true);
}