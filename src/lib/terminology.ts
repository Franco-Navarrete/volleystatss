
export type Gender = 'masculino' | 'femenino' | 'mixto';

export interface SportTerminology {
  scorers: string;
  receptors: string;
  attackers: string;
  blockers: string;
  setters: string;
  liberos: string;
  players: string;
  coaches: string;
  referees: string;
  captain: string;
  mvp: string;
}

const terminology: Record<Gender, SportTerminology> = {
  femenino: {
    scorers: 'Máximas anotadoras',
    receptors: 'Mejores receptoras',
    attackers: 'Mejores atacantes',
    blockers: 'Mejores bloqueadoras',
    setters: 'Mejores armadoras',
    liberos: 'Mejores líberos',
    players: 'Jugadoras',
    coaches: 'Entrenadoras',
    referees: 'Árbitras',
    captain: 'Capitana',
    mvp: 'MVP',
  },
  masculino: {
    scorers: 'Máximos anotadores',
    receptors: 'Mejores receptores',
    attackers: 'Mejores atacantes',
    blockers: 'Mejores bloqueadores',
    setters: 'Mejores armadores',
    liberos: 'Mejores líberos',
    players: 'Jugadores',
    coaches: 'Entrenadores',
    referees: 'Árbitros',
    captain: 'Capitán',
    mvp: 'MVP',
  },
  mixto: {
    scorers: 'Máximos anotadores',
    receptors: 'Mejores receptores',
    attackers: 'Mejores atacantes',
    blockers: 'Mejores bloqueadores',
    setters: 'Mejores armadores',
    liberos: 'Mejores líberos',
    players: 'Jugadores',
    coaches: 'Entrenadores',
    referees: 'Árbitros',
    captain: 'Capitán',
    mvp: 'MVP',
  },
};

export const getTerminology = (gender: Gender = 'mixto'): SportTerminology => {
  return terminology[gender] || terminology.mixto;
};
