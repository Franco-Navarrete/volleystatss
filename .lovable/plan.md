# Motor de Formaciones de Recepción (Sistema 5-1)

Implementar posicionamiento automático de jugadoras en cancha según rotación y sistema táctico, eliminando el movimiento manual antes de cada rally.

## 1. Arquitectura basada en roles tácticos

En lugar de guardar posiciones absolutas por jugadora, modelamos **roles**. Cada rol tiene una coordenada (x,y) para cada una de las 6 rotaciones, en cada sistema.

```ts
type TacticalRole =
  | "setter"          // armadora
  | "opposite"        // opuesta
  | "middle_front"    // central delantera (la que va a entrar a 1er tiempo)
  | "middle_back"     // central zaguera (la que sale o queda atrás)
  | "outside_front"   // punta delantera
  | "outside_back"    // punta zaguera
  | "libero";         // líbero (reemplaza al middle_back en zona 5/6/1)

interface FormationSlot {
  role: TacticalRole;
  x: number;  // 0..100 (% ancho cancha)
  y: number;  // 0..100 (% largo, 0 = red)
}

interface ReceptionFormation {
  system: "5-1";
  rotation: 1 | 2 | 3 | 4 | 5 | 6;  // rotación = zona de la armadora
  slots: FormationSlot[];
}
```

El motor:
1. Recibe `lineup` (qué jugadora ocupa cada rol del 5-1) + `rotation`.
2. Busca la plantilla `(system, rotation)`.
3. Para cada slot, resuelve `role → playerId` y devuelve la posición.
4. Aplica overrides personalizados si existen (`customFormations[matchId][rotation]`).

Esto permite agregar 6-2 / 4-2 con sólo agregar plantillas nuevas, sin tocar el motor.

## 2. Configuración del equipo (lineup 5-1)

Antes del partido el entrenador define el lineup en una nueva sección dentro de la pantalla de partido:

- Armadora titular
- Opuesta
- Central 1 / Central 2
- Punta 1 / Punta 2
- Líbero + a quién reemplaza (por defecto reemplaza a la central que esté en zaguero)

Se guarda en `match.lineups[teamId]: TeamLineup`.

## 3. Plantillas 5-1 (6 rotaciones)

Plantillas derivadas de las imágenes de referencia (VOLEYCA). Para cada rotación R (zona de la armadora):

- **R1** — Armadora en 1 (zaguera derecha). Opuesta sube a 4 a recibir/atacar pipe, central delantera en 3 para 1er tiempo, punta delantera abre a 4, punta zaguera entra en W de recepción, líbero en 5.
- **R2** — Armadora en 2 (delantera derecha, se esconde). Central 3, punta delantera 4. Recepción: punta zaguera + opuesta zaguera + líbero (5).
- **R3** — Armadora en 3 → desplaza a 2 para armar. Central pasa a 4. Punta delantera abre. Recepción en W con líbero.
- **R4** — Armadora en 4 → se desplaza a 2. Central delantera baja a 3. Punta titular pasa al zaguero. Opuesta cubre 1.
- **R5** — Armadora en 5 → sube a 2/3 para armar. Central en 4, opuesta en 2, líbero recibe.
- **R6** — Armadora en 6 → sube entre 2 y 3. Opuesta delantera en 2, central en 3, punta abre a 4, líbero en 6.

Cada plantilla además marca:
- `setterTarget`: zona donde la armadora hace el 2do toque (siempre cerca de 2/3).
- `attackZones`: lista de zonas de ataque disponibles según rotación (z2, z3, z4, pipe, z1, z5).
- `movements`: flechas opcionales (origen → destino) para mostrar desplazamiento post-saque.

Archivo: `src/lib/formations/5-1.ts`.

## 4. Visualización — `<CourtFormation />`

Cancha SVG/CSS con:

- Colores por rol: Armadora naranja, Central verde, Punta azul, Opuesta amarillo, Líbero celeste.
- Número y/o nombre corto sobre cada jugadora.
- Flechas de desplazamiento (opcional, toggle "ver movimientos").
- Drag & drop para reubicar (mouse + touch).
- Botón "Guardar como personalizada" / "Restablecer plantilla".

Componente nuevo: `src/components/court/CourtFormation.tsx`.
Hook: `src/hooks/use-formation.ts` → expone `{ slots, setterZone, attackZones, updateSlot, resetCustom }`.

## 5. Integración con scouting

- Al iniciar el rally / cambiar rotación, el `QuickSettingBar` y la cancha del planillero usan el `useFormation(matchId, teamId, rotation)`.
- La armadora detectada automáticamente para el quick setting sale del rol `setter` (ya no del campo `position` del player).
- Las zonas de ataque disponibles en el selector vienen de `formation.attackZones`.
- Cuando el equipo rota o gana saque, se recalcula sin pedir acción manual.

## 6. Persistencia

- `match.lineups`: lineup por equipo.
- `match.customFormations[teamId][rotation]`: overrides (drag & drop).
- Todo va al store zustand existente y se sincroniza via `cloud-sync.ts` (jsonb en `app_state`). Sin migración SQL nueva.

## 7. Archivos

**Nuevos**
- `src/lib/formations/types.ts` — tipos `TacticalRole`, `FormationSlot`, `ReceptionFormation`, `TeamLineup`.
- `src/lib/formations/5-1.ts` — las 6 plantillas.
- `src/lib/formations/engine.ts` — `resolveFormation(lineup, rotation, system, customs?)`.
- `src/components/court/CourtFormation.tsx` — vista interactiva.
- `src/components/court/LineupEditor.tsx` — configurar lineup 5-1 + líbero.
- `src/hooks/use-formation.ts`.

**Editados**
- `src/lib/volley-store.ts` — agregar `lineups` y `customFormations` al `Match`; acciones `setLineup`, `saveCustomFormation`, `resetCustomFormation`.
- `src/routes/_authenticated/matches.$id.index.tsx` — sección "Formación 5-1" (solo modo entrenador), cancha en vivo arriba del planillero.
- `src/components/scorer/QuickSettingBar.tsx` — armadora y zonas de ataque desde el motor.

## 8. Fuera de alcance (siguiente iteración)

- Sistemas 6-2 y 4-2 (sólo dejar la arquitectura lista).
- Animación de transición entre rotaciones.
- Mostrar la formación del rival.
