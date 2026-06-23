## Plan — Compartir partidos públicos + Premios Rally

### 1. Compartir partido por enlace público

**Modelo de datos (nueva tabla `public_matches`)**

Hoy los partidos viven dentro del jsonb `app_state.data` de cada usuario, sin granularidad para RLS por partido. Para no romper eso, agrego una tabla `public_matches` que guarda un snapshot autocontenido por partido. Al finalizar un partido (o al togglear "Compartir"), se hace upsert del snapshot.

```sql
create table public.public_matches (
  id text primary key,                 -- slug corto (8 chars, base62) único
  match_id text not null,              -- id interno del partido
  owner_id uuid not null references auth.users(id) on delete cascade,
  is_public boolean not null default true,
  data jsonb not null,                 -- snapshot { match, teamA, teamB, league?, players[] }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, match_id)
);
grant select on public.public_matches to anon;          -- solo cuando is_public
grant select, insert, update, delete on public.public_matches to authenticated;
grant all on public.public_matches to service_role;
alter table public.public_matches enable row level security;

create policy "Public can read shared matches"
  on public.public_matches for select to anon
  using (is_public = true);

create policy "Owner manages own shares"
  on public.public_matches for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```

Snapshot incluye: encabezado (equipos, escudos, liga, fecha), `sets[]`, `events[]` (timeline), `lineupHistory`, `mvpPlayerId`, y un `players` enriquecido con `name`/`number`/`position` para no depender del estado del owner.

**Server function pública**

`src/lib/public-match.functions.ts`:
- `getPublicMatch({ slug })`: usa cliente publishable (no admin) + policy `anon`. Devuelve el snapshot o `notFound()` si `is_public=false`.
- `publishMatch({ matchId })` (auth, requireSupabaseAuth): construye snapshot desde el estado actual, upsert con slug autogenerado si no existe.
- `unpublishMatch({ matchId })`: set `is_public=false`.

**Auto-publicar al finalizar**

En `finishMatch` (volley-store) o en el handler de cierre, además del cambio local, se dispara `publishMatch` y se guarda el slug en `match.publicSlug` (campo opcional nuevo). El comportamiento por defecto del usuario es público al finalizar.

**Ruta pública SSR**

`src/routes/m.$slug.tsx` (top-level, **fuera** de `_authenticated`):
- `loader` llama `getPublicMatch({ data: { slug } })` (server fn pública, sin bearer).
- `head()` arma title `"Equipo A X – Y Equipo B · RALLY"`, description con MVP y resultado por set, `og:title`, `og:description`, `og:type: "article"`, `og:url`, canonical autoreferencial. Sin `og:image` por ahora (se puede agregar después con generación dinámica).
- Sin login. `errorComponent` y `notFoundComponent` obligatorios.

**Componente público de detalle**

Reutiliza la presentación actual de `matches.$id.stats.tsx` pero con un wrapper "PublicMatchView" que recibe el snapshot ya armado (no toca zustand). Secciones: header con marcador, sets, MVP, stats por equipo (puntos, ataques, contraataques, bloqueos, aces, errores), stats individuales (tabla), recepción, timeline punto a punto.

**Botón Compartir**

En `matches.$id.tsx` (vista del owner): card "Compartir" con
- Switch público/privado (`is_public`).
- Input read-only con la URL `https://volleystatss.lovable.app/m/{slug}`.
- Botones: Copiar enlace, WhatsApp (`wa.me/?text=`), Facebook (`facebook.com/sharer`), Instagram (no tiene share URL → copiamos y avisamos "pegalo en tu historia"), X/Twitter, "Compartir nativo" (`navigator.share` si existe).

**Sincronización**

`cloud-sync.ts` no toca `public_matches` (es independiente). Si el usuario elimina el partido localmente, agregamos un cleanup en `deleteMatch` que también borra el row público.

---

### 2. Premios Rally (Equipo Ideal + premios individuales)

**Ruta nueva** `src/routes/_authenticated/awards.tsx` agregada al sidebar/`AppShell` con icono trofeo.

**Filtros (selector)**
- Liga: todas / liga específica (default: liga activa más reciente con partidos finalizados).
- Categoría: todas / 12/14/16/18/21/Primera.
- Género: todos / F / M.

Se calculan **sobre los partidos finalizados que entren en el filtro**.

**Algoritmo**

Nuevo módulo `src/lib/awards.ts`:

```text
score_armadora   = w.mvp*mvpCount + w.wins*teamWinPct + w.eff*teamOffEff
score_punta      = w.atk*attackPts + w.counter*counterPts + w.ace*aces + w.eff*atkEff
score_central    = w.blk*blocks + w.atk*attackPts + w.eff*atkEff
score_opuesta    = w.pts*totalPts + w.counter*counterPts + w.eff*atkEff
score_libero     = w.rec*goodRec + w.recEff*recEff − w.err*recErrors
```

Pesos default (configurables en UI con sliders en un sheet "Ajustar fórmula", persistidos en localStorage):
- Ataques 40 / Bloqueos 30 / Aces 15 / MVP 15 (base), con ajustes por posición.

Requisito mínimo: jugadora debe haber jugado en >= N partidos del scope (slider, default 3) o el N% de partidos, para evitar oneshots.

**Selección**
- Por cada posición, tomar el top score. Para Puntas/Centrales tomar top 2.
- Si no hay suficientes en una posición se muestra slot vacío con mensaje "Sin candidatas".

**Premios individuales**
- MVP del torneo: top score combinado (ataques+bloqueos+aces+MVP) sin restricción de posición.
- Mejor atacante: max puntos de ataque.
- Mejor bloqueadora: max bloqueos.
- Mejor sacadora: max aces.
- Mejor receptora: max % recepción (con mínimo de recepciones).
- Máxima anotadora: max puntos totales.
- Revelación: top jugadora con menos partidos previos en la liga (heurística: jugó solo en últimos 30% de fechas y entró en top 10 de puntos).

**UI**

`awards.tsx`:
- Header "Premios Rally" + selector liga/categoría/género + botón "Ajustar fórmula".
- Sección **Equipo Ideal** con 7 cards (Armadora / Puntas / Centrales / Opuesta / Líbero) mostrando foto/inicial, nombre, equipo, score y top stat.
- Sección **Premios individuales** en grid 2-cols mobile con cada categoría.
- Mensaje vacío si no hay partidos finalizados en el scope.
- Botón "Compartir Premios" → mismo flujo que el compartir partido pero generando un slug en `public_awards` (futuro; no incluido en este plan para no inflar el scope, se puede agregar después).

---

### 3. Orden de ejecución y verificación

1. Migración `public_matches` (paso a aprobación).
2. Server fns `getPublicMatch` / `publishMatch` / `unpublishMatch`.
3. Ruta `/m/$slug` + componente `PublicMatchView` reutilizando piezas de stats.
4. Card "Compartir" en detalle del partido + autopublicación en `finishMatch`.
5. Verificar con Playwright: abrir `/m/<slug>` sin sesión, comprobar render + meta tags.
6. `awards.ts` (lógica pura) + tests rápidos en consola con un partido seed.
7. `awards.tsx` + entrada en `AppShell`.
8. Verificación visual mobile (430px).

Sin cambios en `client.ts`, `types.ts` se regenera tras la migración.

### Detalles técnicos para no olvidar

- Slug: `nanoid(8)` base62 (paquete `nanoid` ya disponible en deps de TanStack; si no, custom con `crypto.getRandomValues`).
- Snapshot: hacer deep clone con `structuredClone` para no compartir refs con zustand.
- Server fn pública usa cliente publishable creado dentro del handler (no admin), respetando la policy `anon`.
- `head()` recibe `loaderData`; arma texto en español ("Femenino · Sub-16 · Liga Apertura 2026").
- Recepción %: ya está en `historical-stats.ts`, reutilizar `computeHistoricalStats` filtrado por scope para alimentar Premios.
- Pesos por posición vivos en `mem://features/awards-formula` para que sobrevivan a refactors.
