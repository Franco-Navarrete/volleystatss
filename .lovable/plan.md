
# Modos de Estadísticas: Liga vs Entrenador

## Concepto

Una sola app, una sola base de datos. Cada **liga** tiene un campo `statsMode` que define qué interfaz se muestra a quienes consultan/cargan datos de esa liga:

- `"liga"` (default) → planillero simple, solo resultados/rankings/MVP.
- `"entrenador"` → todo lo anterior + recepción, ataque por zona, rotaciones, tendencias, comparativas.

Los eventos del partido se siguen guardando igual (no se duplica info). Lo que cambia es **qué se muestra y qué se pide cargar**.

## Cambios por capa

### 1. Modelo de datos (store + cloud-sync)
- Agregar `statsMode: 'liga' | 'entrenador'` en la entidad `League` (default `'liga'`).
- Migración suave en `volley-store`: si una liga no tiene el campo, asumir `'liga'`.
- Ligas sueltas / equipos sin liga → siempre modo `'liga'`.

Eventos del partido: se mantienen los actuales (`attack`, `block`, `ace`, `reception`, etc.). Para el modo entrenador agrego campos opcionales en el evento de ataque/recepción:

```ts
type AttackEvent  = { kind:'attack',  zone?: 'z4'|'z3'|'z2'|'zag', result:'point'|'error'|'in', rotation?: 1|2|3|4|5|6 }
type ReceptionEvent = { kind:'reception', quality: '++'|'+'|'!'|'-'|'=' }
```

Si el modo es `'liga'`, el planillero no pide estos campos extra y se guardan como `undefined`. Compatibilidad total hacia atrás.

### 2. Configuración de la liga
- En la pantalla de edición de liga (`/ligas/$id` admin / formulario): toggle "Modo de estadísticas" con dos opciones y un texto breve de qué incluye cada una.
- Sólo admins / managers de la liga pueden cambiarlo.

### 3. Planillero (carga en vivo)
- Hook `useStatsMode(leagueId)` que devuelve `'liga' | 'entrenador'`.
- Componente `LiveScorer`:
  - Modo liga: botones rápidos actuales (punto, ataque, bloqueo, ace, error). Sin zona, sin rotación, sin calidad de recepción.
  - Modo entrenador: al marcar ataque pide zona (Z4/Z3/Z2/Zag) y rotación actual (R1–R6); al marcar recepción pide calidad (++/+/!/-/=). Pickers rápidos, mobile-first, default a la última opción usada.

### 4. Vistas y rankings

**Modo liga** (lo que ya existe, limpio):
- Resultado, sets, punto a punto.
- Tabla: PJ, PG, PP, Sets a favor/contra, Puntos.
- Rankings: máxima anotadora, mejor bloqueadora, mejor sacadora, MVP.
- Perfil jugadora / equipo: stats básicas.

**Modo entrenador** (vistas extra, sólo visibles si la liga es `entrenador`):
- Pestaña "Recepción": % de cada calidad (++, +, !, -, =), por jugadora y por equipo.
- Pestaña "Ataque por zona": intentos / puntos / errores / eficiencia (`(puntos - errores) / intentos`) por Z4, Z3, Z2, Zag.
- Pestaña "Rotaciones": R1–R6 con PF, PC, diferencia, % efectividad.
- Pestaña "Rendimiento por set": % por set 1/2/3/(4/5).
- Pestaña "Tendencias": últimos 5 partidos — recepción / ataque / bloqueo.
- Pestaña "Comparativas": mi equipo vs promedio de la liga.

Cálculos derivados en `src/lib/coach-stats.ts` (puro, sobre los eventos ya guardados).

### 5. Visibilidad / permisos
- `statsMode` se aplica también en las vistas públicas (perfil jugadora, perfil equipo, partido compartido `/m/$slug`).
- Si la liga del partido está en modo `'liga'`, las pestañas avanzadas no se muestran ni en pública ni en privada.
- No se agregan roles nuevos. Roles actuales (admin / acceso a liga) deciden quién edita el `statsMode`.

### 6. Migración
1. Migración del store: agregar `statsMode: 'liga'` a todas las ligas existentes al cargar.
2. Sin migración SQL: `app_state` ya es jsonb, se sincroniza solo.
3. Ningún dato existente se pierde; sólo se ocultan/muestran vistas.

## Archivos a tocar / crear

Crear:
- `src/lib/coach-stats.ts` — cálculos avanzados (recepción %, ataque por zona, rotaciones, tendencias, comparativas).
- `src/components/scorer/AdvancedAttackPicker.tsx` — picker de zona + rotación.
- `src/components/scorer/ReceptionQualityPicker.tsx`.
- `src/components/coach/*` — paneles Recepción, Ataque por zona, Rotaciones, Rendimiento por set, Tendencias, Comparativas.
- `src/hooks/useStatsMode.ts`.

Editar:
- `src/lib/volley-store.ts` — tipos `League`, `MatchEvent`, default `statsMode`, migración suave.
- Form de liga (crear/editar) — toggle modo.
- Vista de partido en vivo (planillero) — branch según modo.
- Vista de partido / perfil equipo / perfil jugadora — pestañas extra sólo en modo entrenador.
- Página pública `/m/$slug` y `/jugadora/$id` — mismo branching.

## Lo que NO se hace (por ahora)
- No se crean dos apps separadas.
- No se duplican eventos en la BD.
- No se agregan roles nuevos.
- "Récords personales" (de un mensaje anterior) ya está fuera de scope acá; se queda como está.

¿Avanzo con esta estructura, o querés ajustar algo (p. ej. mover algún panel del modo entrenador al modo liga, o que el toggle sea por equipo en vez de por liga)?
