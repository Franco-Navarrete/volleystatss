
# Rediseño pantalla de toma en vivo (`/matches/$id`)

Objetivo: acelerar el registro para 1 solo entrenador manteniendo la identidad Rally (tema oscuro, colores, tipografía). **No se toca la lógica de registro ni el flujo de acciones** — solo layout, jerarquía visual, ayudas contextuales y micro‑animaciones.

Archivo principal: `src/routes/_authenticated/matches.$id.index.tsx` (2499 líneas). Se apoya en varios componentes nuevos pequeños para no inflar el archivo.

## Áreas de trabajo

### 1. Layout general — la cancha manda
Grid a 3 filas: **header 8–10%** · **cancha 65–70%** · **barra inferior 8–10%**, con dos columnas de utilidades ultra‑delgadas a los lados de la cancha (56–64px). Se reducen paddings actuales y se elimina el `max-width` que aún limita en desktop.

### 2. Marcador superior compacto
Una sola fila (≈56–64px):

```text
[LIVE] [Local logo] LOC 21 · Sets 1 · SAQUE ●   |   VIS 18 · Sets 0   [Visit logo]   ⏱ 34:21   [⋮]
```

- Nombres cortos, puntos y sets en la misma línea con separadores.
- Chip “SAQUE” con punto pulsante junto al equipo al saque.
- Cronómetro y estado LIVE integrados al mismo renglón.
- Menú `⋮` para acciones frías (Formato, Fin del partido, etc.).

### 3. Botones laterales cuadrados con icono + tooltip
Convertir `Cambio / Líbero / Tiempo / Sanción` en columna de botones 44×44 con `lucide-react` (`Repeat`, `Shirt`, `Timer`, `AlertTriangle`) y `Tooltip` de shadcn. Un lado por equipo. Deshacer y Formación se elevan (más grandes / color primario). Estadísticas, Formato y Fin del partido se mueven al menú `⋮`.

### 4. Jugadores en la cancha
Ya existe `CourtPlayerBadge` (foto/iniciales + insignia número + hover stats). Se reutiliza y se refuerza:
- Sin nombre dentro del círculo (ya está así).
- Insignia número sobresaliente y siempre legible.
- Al seleccionar para registrar acción → clase `.player-active` con halo pulsante (`ring-4 ring-primary/70 animate-pulse` + `box-shadow` glow).

### 5. Micro‑animaciones de acción
Ya hay `HIGHLIGHT_STYLE` (ACE/PUNTO/BLOQUEO/REC+). Añadir keyframe `player-pop` (scale 1 → 1.12 → 1, 900ms) al detectar nuevo evento del jugador. Definido en `src/styles.css` para no depender de tailwind config.

### 6. Barra de progreso del rally
Nuevo componente `RallyProgressBar` sobre la cancha:

```text
● SAQUE ✔  →  ● RECEPCIÓN ✔  →  ● ARMADO ✔  →  ○ ATAQUE  →  ○ BLOQUEO  →  ○ DEFENSA
```

Deriva estado del store leyendo los últimos eventos del rally en curso (sin cambiar la lógica: solo lectura). Al finalizar el rally muestra “✔ Rally finalizado” y se resetea al siguiente saque.

### 7. Panel “Acción actual”
Chip flotante arriba‑derecha de la cancha:

```text
ACCIÓN ACTUAL
Recepción positiva · #7
Esperando armado…
```

Se alimenta del mismo estado que la barra de progreso.

### 8. Panel “Última acción”
Chip flotante abajo‑izquierda:

```text
ÚLTIMA · Ramiro
Ataque JATU · Z5 · PUNTO
```

Lee el último `PointEvent` del `match.events`.

### 9. Indicador de posesión
Cinta fina bajo el marcador con `LOCAL ATACANDO · VISITANTE DEFENDIENDO`, calculado desde el equipo al saque y el último evento (recepción/ataque). Cambia automáticamente sin intervención.

### 10. Cancha con zonas diferenciadas
Añadir en `CourtFormation` (o wrapper) un sutil degradado / `bg-white/[0.02]` para zona de ataque vs zona de defensa, sin cambiar coordenadas ni tamaños de jugadores. Puramente cosmético.

### 11. Jerarquía de botones
- **Grandes / primarios**: Armado, Formación, Deshacer.
- **Medianos**: acciones laterales por equipo.
- **En menú `⋮`**: Estadísticas, Formato, Fin del partido, Reclasificar, Compartir.

## Detalles técnicos

Nuevos archivos:
- `src/components/scorer/ScorerHeader.tsx` — marcador compacto + posesión + menú.
- `src/components/scorer/SideActionsRail.tsx` — columna de botones icónicos con tooltip.
- `src/components/scorer/RallyProgressBar.tsx` — 6 pasos + estado finalizado.
- `src/components/scorer/CurrentActionCard.tsx` y `LastActionCard.tsx` — chips flotantes.
- `src/lib/rally-phase.ts` — helper puro que dada `match.events` devuelve `{ phase, lastEvent, possession, playerId, description }`. Cero mutaciones al store.

Cambios a archivos existentes:
- `src/routes/_authenticated/matches.$id.index.tsx` — reemplazar layout del header + laterales + barra inferior, montar los nuevos paneles. Toda la lógica de handlers `onRegister…` se mantiene idéntica; solo cambian los componentes visuales que la disparan.
- `src/components/court/CourtPlayerBadge.tsx` — nueva prop `active` para el halo del jugador seleccionado.
- `src/styles.css` — keyframes `player-pop`, clases `.player-active`, sutil gradiente de zonas.

Restricciones respetadas:
- Sin tocar el store (`src/lib/volley-store.ts`) ni los diálogos de registro (`IntegratedRallyDialog`, `AttackResultDialog`, etc.).
- Sin cambiar tipos de eventos ni cálculos de estadísticas.
- Se mantiene el modo tablet horizontal ya existente.
- Todo en tokens semánticos (`bg-card`, `text-primary`, `border-border`), sin colores hardcoded.

## Fuera de alcance (no se toca)
- Lógica de rotaciones, líbero automático, fórmulas de eficiencia.
- Flujo secuencial del diálogo de rally.
- Vista pública `/m/$slug` (solo se beneficia indirectamente del badge activo si se comparte).

Confirmá y avanzo con la implementación en un solo turno.
