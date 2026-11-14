# Rugby

Siga sus equipos de rugby en Gladys: el próximo partido en hora local, el marcador en directo, el último
resultado y la clasificación, para sus paneles y sus escenas.

## Lo que obtiene

- Un dispositivo por equipo seguido (Stade Toulousain, Francia, Leinster…), con su próximo partido, saque
  inicial, estadio, último resultado, marcador en directo y clasificación.
- Disparadores de escena: **Partido a punto de empezar**, **Saque inicial**, **Partido terminado** (con el
  resultado: victoria, empate o derrota).
- Una acción de escena que escribe frases listas para enviar o decir en voz alta.
- Un widget de panel **Equipo de rugby**.

## Competiciones

Top 14, Premiership, United Rugby Championship, Super Rugby Pacific, Champions Cup, Challenge Cup, Seis
Naciones, Rugby Championship, Nations Championship (test de otoño), otros test matches y la Copa del Mundo.
La Pro D2 no se ofrece: ESPN no la sirve.

## Puesta en marcha

1. En la pestaña **Configuración**, marque las competiciones que le interesan y elija el idioma de los
   textos (francés por defecto), luego guarde.
2. Abra la pestaña **Descubrir**: aparecen todos los equipos de esas competiciones. Añada los que sigue;
   cada uno se convierte en un dispositivo.
3. Pulse **Comprobar** para volver a leer ESPN y ver lo que la integración sabe de sus equipos.

Un equipo juega varias competiciones (Stade Toulousain: Top 14 y Champions Cup): su dispositivo reúne los
partidos de todas las competiciones marcadas. Su clasificación viene de la primera competición de la lista
que lo clasifica, su liga antes de su copa europea.

## Dispositivos

| Función               | Valor                                                                   |
| --------------------- | ----------------------------------------------------------------------- |
| Próximo partido       | «Lyon – Stade Toulousain (Top 14)», el equipo local primero             |
| Saque inicial         | Día y hora en la zona horaria de Gladys (solo el día si no está fijada) |
| Estadio               | Estadio y ciudad, y la cadena de TV cuando ESPN la da                   |
| Último resultado      | «Victoria 28-18 contra Clermont Auvergne (Top 14)»                      |
| Días hasta el partido | 0 el día del partido, -1 cuando no hay ningún partido previsto          |
| Partido en juego      | 1 durante un partido                                                    |
| Partido hoy           | 1 el día del partido                                                    |
| Puntos del equipo     | Durante un partido el marcador en directo, luego el del último partido  |
| Puntos del rival      | Igual, para el rival                                                    |
| Clasificación         | Puesto en la liga, o en el grupo de una copa                            |

Los nombres de las funciones se fijan al añadir un equipo: cambie el idioma antes de añadir sus equipos.

## Escenas

### Disparadores

- **Partido a punto de empezar**: 15, 30, 60 o 120 minutos antes del saque inicial previsto de un equipo
  seguido (solo cuando se conoce la hora).
- **Saque inicial**: cuando ESPN indica que el partido ha empezado, con un minuto de margen.
- **Partido terminado**: al final del partido. Su filtro **Resultado** solo conserva victorias, empates o
  derrotas: elija **Victoria** para celebrarlo.

Deje **Equipo** vacío para todos los equipos seguidos. La escena puede leer el equipo, el rival, la
competición, local o visitante, la hora del saque inicial, el estadio, los marcadores, el resultado y una
**frase** ya escrita.

### Acción

**Leer las novedades de un equipo** devuelve un resumen, el próximo partido y el último resultado en forma
de frases, si hay un partido en juego y los días hasta el próximo partido. Envíelas en un mensaje o haga que
se digan en voz alta.

## Panel

El widget **Equipo de rugby** muestra un equipo seguido: el marcador en directo durante un partido, la
cuenta atrás hasta el siguiente, la clasificación, los tres próximos partidos y el último resultado. Sus
ajustes eligen el equipo y pueden ocultar los próximos partidos o el último resultado.

## Datos y límites

- Los datos vienen de la API JSON pública de ESPN (`site.api.espn.com`): sin cuenta ni clave. **Esta API no
  es oficial ni está documentada**: puede cambiar o dejar de funcionar sin aviso. La integración la lee con
  moderación: los equipos una vez al día, los partidos de cada competición cada 6 horas (cinco peticiones:
  del mes pasado a tres meses vista), las clasificaciones cada 6 horas y después de un partido, y el
  marcador del día **cada minuto solo durante un partido de un equipo seguido**, desde 5 minutos antes del
  saque inicial.
- Los partidos a más de tres meses no se leen: en noviembre, el próximo Seis Naciones todavía no aparece.
- ESPN da los nombres de los equipos en inglés, sin acentos (Stade Francais Paris); las selecciones
  nacionales se traducen.
- La cadena de TV rara vez se da para el rugby europeo.
- No se rellena ningún calendario de Gladys: una integración es de tipo dispositivo o de tipo calendario.
- Sin relación con ESPN, las ligas ni los clubes.

## Solución de problemas

- **Ningún equipo en la pestaña Descubrir**: marque al menos una competición y guarde, luego pulse
  **Comprobar**. Si no se puede leer ESPN, el estado de la integración lo indica.
- **Un valor queda vacío**: la integración nunca adivina; la clasificación aparece en cuanto ESPN publica la
  de la temporada.
- Registros: la integración registra su arranque y sus errores; `LOG_LEVEL=debug` para cada lectura.
