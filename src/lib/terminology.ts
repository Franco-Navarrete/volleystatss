
export type Gender = 'masculino' | 'femenino' | 'mixto';

export interface SportTerminology {
  scorers: string;
  receptors: string;
  attackers: string;
  blockers: string;
  setters: string;
  servers: string;
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
    servers: 'Mejores sacadoras',
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
    servers: 'Mejores sacadores',
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
    servers: 'Mejores sacadores',
    liberos: 'Mejores líberos',
    players: 'Jugadores',
    coaches: 'Entrenadores',
    referees: 'Árbitros',
    captain: 'Capitán',
    mvp: 'MVP',
  },
};

export const getTerminology = (gender: Gender = 'mixto'): SportTerminology => {
  const result = terminology[gender] || terminology.mixto;
  
  // Fallback para campos individuales si faltaran en el objeto (seguridad extra)
  if (gender !== 'mixto') {
    const fallback = terminology.mixto;
    const final = { ...result };
    
    (Object.keys(fallback) as Array<keyof SportTerminology>).forEach(key => {
      if (!final[key]) {
        final[key] = fallback[key];
      }
    });
    
    return final;
  }
  
  return result;
};
