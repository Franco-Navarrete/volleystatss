# Rankings históricos

## Resumen

Nueva sección **Rankings** con todos los acumulados de jugadoras a lo largo de todos los partidos finalizados. Además, dentro de cada equipo se agrega una pestaña *Rankings* con la misma información filtrada al plantel del equipo.

Se incluyen récords personales, últimos 5 partidos y promedios por partido.

## Nota técnica sobre "tabla acumulada"

Elegiste mantener una tabla acumulada que se actualice al finalizar el partido. Hay un detalle importante de tu app: hoy **todos los datos viven en un único `app_state` (jsonb)** sincronizado desde zustand. El cálculo "al vuelo" desde los partidos finalizados es prácticamente instantáneo y nunca puede desincronizarse.

Voy a implementarlo de la siguiente forma, que combina lo mejor de los dos enfoques:

- Un módulo `src/lib/historical-stats.ts` que recorre `matches.filter(status === "finished")` y devuelve los acumulados.
- El resultado se cachea con `useMemo` y solo se recalcula cuando cambia la lista de partidos (es decir, cuando finalizás uno). UX idéntica a una tabla acumulada, sin riesgo de quedar desincronizado y sin migración de datos viejos.

Si más adelante el volumen crece mucho podemos persistirlo en `app_state.cachedStats` sin cambiar la UI.

## Qué se construye

### Datos calculados por jugadora (todo el histórico)

- Partidos jugados (donde tuvo al menos 1 evento o estuvo en lineup)
- Puntos totales = ataques + bloqueos + aces
- Ataques, contraataques, ataques de rotación, bloqueos, aces
- Errores: saque, ataque, no forzados
- MVP ganados (índice MVP más alto del partido, mismo cálculo que ya usás en `matches.$id.stats.tsx`)
- Promedios por partido de cada métrica
- **Récords**: mejor marca en un solo partido (puntos, bloqueos, aces) con rival y fecha
- **Últimos 5 partidos**: rival, fecha, puntos

### Rankings mostrados

- Máximas anotadoras (puntos)
- Mejores atacantes
- Mejores contraatacantes
- Mejores bloqueadoras
- Mejores sacadoras (aces)
- Más MVP
- (Bonus) Mejor promedio de puntos (mínimo 3 partidos para evitar outliers)

Cada lista muestra top 10, con podio destacado para los 3 primeros, foto y equipo.

### Pantallas

1. **Nueva ruta `/rankings`** (global, todas las jugadoras de todos los equipos).
   - Tabs: *Puntos · Ataques · Contraataques · Bloqueos · Aces · MVP · Promedios · Récords*.
   - Link nuevo en el menú principal (header).
2. **Pestaña "Rankings" dentro de cada equipo** (`/teams` → equipo seleccionado).
   - Mismas tabs pero filtradas al plantel.
3. **Vista detalle de jugadora** (modal o sheet) al tocarla en un ranking:
   - Totales + promedios.
   - Récords personales.
   - Últimos 5 partidos.

## Diseño

Mobile-first (90% celular). Reusa los tokens existentes (sin colores hardcodeados):

- Podio top 3 con medallas 🥇🥈🥉, número grande tabular, foto circular.
- Resto en lista compacta con #posición · foto · nombre · equipo · valor.
- Tabs horizontales con scroll si no entran.

## Archivos a crear / modificar

```text
src/lib/historical-stats.ts           NUEVO  agregador + tipos + cálculo MVP por partido
src/routes/_authenticated/rankings.tsx NUEVO  pantalla global con tabs
src/components/RankingList.tsx        NUEVO  lista reutilizable (podio + top N)
src/components/PlayerHistoryCard.tsx  NUEVO  detalle: totales, récords, últimos 5
src/routes/_authenticated/teams.tsx   EDIT   nueva tab "Rankings" dentro del equipo
src/components/AppShell.tsx           EDIT   nuevo NavLink "Rankings"
```

## Cambios de datos

Ninguno. No se modifican tablas ni `app_state`. Se trabaja con los `matches` ya existentes (cualquier partido en estado `finished` cuenta).

## Fuera de alcance (para iteraciones futuras)

- Filtros por liga / temporada / año (pediste solo "toda la historia").
- Persistencia del agregado en la base.
- Comparar dos jugadoras lado a lado.
