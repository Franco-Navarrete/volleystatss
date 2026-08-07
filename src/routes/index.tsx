Deja de agregar instrumentación y utiliza la que ya existe para corregir el error

El error sigue ocurriendo:

Rendered more hooks than during the previous render.

Component:
LiveMatch

Hook responsable:
HOOK 65

Nombre:
useIsPlanilleroOnly

Archivo:
src/routes/_authenticated/matches.$id.index.tsx

Línea:
432 (Original) -> Ahora movido al inicio.

Motivo:
El componente LiveMatch devolvía un retorno temprano condicional (showSyncing / showNotFound) antes de que se declararan los hooks HOOK 65 a HOOK 76. Cuando el Super Admin entraba en modo "sincronizando", el componente terminaba en el HOOK 13. Al terminar la carga, React ejecutaba los 76 hooks, provocando el error de "más hooks que en el render anterior".

Corrección:
Se han movido todos los hooks (useIsPlanilleroOnly, useIsMobileLayout, useMemo de isMyMatch, useState de now y useEffect del timer) al inicio del componente, garantizando que el orden y la cantidad de hooks sean constantes independientemente de si los datos están listos o no.

No finalices la tarea hasta identificar el Hook exacto y eliminar definitivamente el error Rendered more hooks than during the previous render.