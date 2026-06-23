## Fase 1 — Inicio público + Liga + Partido (modo espectador)

Esta fase entrega la experiencia de visitante para Inicio, Liga y Partido, con dos menús separados (invitado vs admin). **Equipos** y **Rankings** públicos completos quedan para Fase 2 (los rankings de la home y los del share de partido ya existen y se reutilizan).

---

### Decisión arquitectónica clave

Hoy los datos viven en `zustand` + `app_state` jsonb por usuario. Las tablas `leagues / teams / players / matches / match_sets / match_events / match_lineups` existen en la DB pero **no se usan como fuente de verdad** del frontend.

Para que cualquier visitante vea TODO sin login, propongo un **enfoque híbrido** que evita reescribir el store y todo el flujo de carga:

- Mantener `zustand + app_state` como fuente de verdad del autor (admin).
- Agregar un **mirror público** automático: cada vez que el admin sincroniza a la nube, los datos se proyectan también a las tablas relacionales con políticas `TO anon SELECT`.
- El frontend público lee **sólo** de esas tablas relacionales vía server functions con cliente publishable (sin login).

Esto es ~80% del beneficio de la opción "migrar a tablas relacionales" con ~20% del riesgo. La migración total del store queda como evolución posterior cuando se quiera permitir carga colaborativa.

```text
Admin (zustand)
   │ cloud-sync.ts (existente)
   ▼
app_state.data (jsonb por usuario)   ← fuente de verdad del autor
   │ NUEVO: projectToPublicTables()
   ▼
leagues / teams / players / matches / match_sets / match_events  ← lectura pública
   │
   ▼
Visitantes (sin login) — server fns con cliente publishable
```

---

### 1. Base de datos (migración)

**Columnas nuevas** (no se rompe nada existente):
- `leagues.is_public boolean default true`, `leagues.owner_id uuid` (apunta al user que la publica; el superadmin por defecto).
- `teams.is_public`, `teams.owner_id`.
- `matches.is_public`, `matches.owner_id`, `matches.public_slug text unique` (mismo slug que `public_matches` cuando exista, para compatibilidad).
- `players.is_public`, `players.owner_id`.

**Políticas RLS nuevas** (`TO anon` SELECT) en `leagues`, `teams`, `players`, `matches`, `match_sets`, `match_events`, `match_lineups` filtrando por `is_public = true` (o por el `is_public` de la liga/partido padre en el caso de hijos). Las políticas `authenticated` existentes se conservan.

**GRANT SELECT TO anon** en esas 7 tablas.

**Función `public.project_user_state_to_public(_user_id uuid, _data jsonb)`** (security definer): toma el `app_state.data` del usuario y hace `upsert` en las tablas relacionales con `is_public = true`, `owner_id = _user_id`. Borra filas huérfanas del mismo `owner_id` que ya no estén en el snapshot. Esto se llama desde el server fn de sync, no por trigger (más fácil de testear y revertir).

---

### 2. Sincronización pública

Editar `src/lib/cloud-sync.ts` (o crear un wrapper `src/lib/public-mirror.functions.ts`) para que el `saveAppState` server fn, después de guardar `app_state`, llame a `project_user_state_to_public(userId, data)`.

- Es idempotente (upsert + delete por diferencia).
- Sólo afecta a usuarios marcados como "publicadores" (en Fase 1: sólo el superadmin `franco.e.navarrete@gmail.com`). Esto se controla con una flag simple en el server fn: `if (await hasRole(userId, 'admin')) { project... }`.
- Esto reemplaza la necesidad del `ShareMatchCard` de mantener un snapshot separado por partido (sigue existiendo `public_matches` para el live ya implementado y se conserva).

---

### 3. Server functions públicas

Nuevo archivo `src/lib/public-data.functions.ts` con un cliente publishable (sin auth, sin `localStorage`):

- `getHomeData()` → devuelve `{ liveMatches, upcomingMatches, recentMatches, activeLeagues, topRankings }`. Una sola llamada para la home, cacheable.
- `getLeague({ id })` → liga + equipos + partidos + posiciones calculadas.
- `getPublicMatch({ id | slug })` → ya existe; se extiende para aceptar `id` además del `slug`.

Todas son `createServerFn({ method: 'GET' })` sin `requireSupabaseAuth`, leyendo con cliente publishable + RLS `anon`.

---

### 4. Rutas y navegación

**Públicas nuevas** (fuera de `_authenticated/`):
- `src/routes/index.tsx` — **se reemplaza** la home actual por la home espectador (5 secciones). La home actual de admin se mueve a `src/routes/_authenticated/dashboard.tsx`.
- `src/routes/ligas.tsx` (layout) y `src/routes/ligas.index.tsx` (listado).
- `src/routes/ligas.$id.tsx` — pestañas Tabla / Partidos / Equipos / Estadísticas (las 4 pestañas se muestran; en Fase 1 "Equipos" y "Estadísticas" usan componentes mínimos que linkean a Fase 2).
- `src/routes/partidos.$id.tsx` — vista pública en vivo del partido (reutiliza `PublicMatchView` ya implementado, con auto-refresh cada 8 s mientras esté `live`).
- `src/routes/auth.tsx` — ya existe.

Cada ruta nueva con `head()` con `title`, `description`, `og:title`, `og:description`, `og:url`, canonical (en leaf). El partido también lleva `og:type: article`.

**Admin** (se renombra menú): el `AppShell` actual (Partidos, Equipos, Ligas, Rankings, Premios, Settings) sigue bajo `/_authenticated/*` pero se le agrega un header distinto que diga "Panel de admin" y un link "Volver al sitio público". Las rutas internas siguen donde están.

**Componente nuevo `PublicShell`** (header móvil con: Inicio · Ligas · Partidos · Equipos · Rankings · Iniciar sesión). Si el usuario está logueado, "Iniciar sesión" se reemplaza por un botón "Panel admin" que va a `/_authenticated/dashboard`.

---

### 5. Páginas (Fase 1)

**Inicio espectador** — 5 secciones tal como pidió, mobile-first (90% celular):
1. Partidos en vivo (cards con marcador, set actual, botón "Ver partido" → `/partidos/$id`).
2. Próximos partidos (orden por fecha; toma `matches` con `status='scheduled'` y `scheduled_at >= now()`).
3. Últimos resultados (`status='finished'`, orden desc).
4. Ligas activas (cards con nombre, temporada, cantidad de equipos).
5. Rankings destacados (4 cards: máxima anotadora, mejor bloqueadora, mejor sacadora, MVP). Reutiliza lógica de `historical-stats.ts` y `awards.ts` ya implementadas.

**Liga `/ligas/$id`** — header con nombre/temporada/categoría/género + tabs:
- Tabla: posiciones (puntos por sets ganados/perdidos, victorias, derrotas).
- Partidos: lista por fecha (pasados y futuros).
- Equipos: grid de cards (Fase 1: nombre + escudo + link futuro).
- Estadísticas: top 5 de cada ranking (Fase 1: reutiliza componente compacto de `RankingList`).

**Partido `/partidos/$id`** — vista pública existente (`PublicMatchView`) con punto a punto y refresh 8 s. Funciona para `live` y `finished`. URL canónica nueva; el viejo `/m/$slug` redirige a `/partidos/$id` para no romper links compartidos.

---

### 6. Caché y performance

- `getHomeData` con `staleTime: 30_000` en el cliente (TanStack Query) y `refetchInterval: 15_000` sólo si hay matches `live`.
- `getLeague`: `staleTime: 60_000`.
- `getPublicMatch`: refetch 8 s en `live`, sin refetch en `finished`.
- SSR habilitado en todas las rutas públicas para SEO (las protegidas siguen `ssr: false`).

---

### 7. SEO

- `head()` por ruta con `og:*` y `twitter:*`.
- Canonical en cada leaf apuntando a `https://volleystatss.lovable.app/...`.
- JSON-LD `SportsEvent` en `/partidos/$id` y `SportsTeam` para listas (cuando lleguen en Fase 2).
- Robots: index por defecto en todas las públicas.

---

### 8. Plan de ejecución (orden)

1. **Migración SQL**: columnas nuevas + función `project_user_state_to_public` + políticas RLS `TO anon` + GRANTs. *(Una sola migración.)*
2. **Backfill** del superadmin: invocar `project_user_state_to_public` una vez con su estado actual.
3. **Modificar `cloud-sync`** para llamar la proyección después de guardar.
4. **`public-data.functions.ts`** + cliente publishable server-side.
5. **`PublicShell`** + reemplazo de `src/routes/index.tsx` (mover la actual a `_authenticated/dashboard.tsx`).
6. **Rutas `/ligas`, `/ligas/$id`, `/partidos/$id`** con `head()` SEO.
7. **Redirect** de `/m/$slug` → `/partidos/$id`.
8. **Verificación** en preview móvil (430 px) y test rápido como invitado (incógnito).

---

### Lo que NO entra en Fase 1

- Página `/equipos/$id` completa (Fase 2).
- Página `/rankings` completa con filtros (Fase 2).
- Migración total del store a tablas relacionales (queda para cuando se quiera carga colaborativa).
- Cambios en flujos de admin (carga de partidos, score keeper, etc. — siguen intactos).

¿Aprobás este plan para que empiece con la migración?
