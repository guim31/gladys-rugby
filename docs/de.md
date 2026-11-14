# Rugby

Verfolge deine Rugby-Teams in Gladys: das nächste Spiel in Ortszeit, den Live-Stand, das letzte Ergebnis
und den Tabellenplatz, für deine Dashboards und Szenen.

## Was du bekommst

- Ein Gerät pro verfolgtem Team (Stade Toulousain, Frankreich, Leinster…) mit nächstem Spiel, Anstoß,
  Spielort, letztem Ergebnis, Live-Stand und Tabellenplatz.
- Szenen-Auslöser: **Spiel beginnt bald**, **Anstoß**, **Spiel beendet** (mit dem Ergebnis: Sieg,
  Unentschieden oder Niederlage).
- Eine Szenen-Aktion, die fertige Sätze zum Senden oder Vorlesen schreibt.
- Ein Dashboard-Widget **Rugby-Team**.

## Wettbewerbe

Top 14, Premiership, United Rugby Championship, Super Rugby Pacific, Champions Cup, Challenge Cup, Six
Nations, Rugby Championship, Nations Championship (Herbst-Testspiele), andere Testspiele und die
Rugby-Weltmeisterschaft. Pro D2 wird nicht angeboten: ESPN liefert sie nicht.

## Einrichtung

1. Kreuze im Tab **Konfiguration** deine Wettbewerbe an und wähle die Sprache der Texte (standardmäßig
   Französisch), dann speichere.
2. Öffne den Tab **Entdecken**: Alle Teams dieser Wettbewerbe sind aufgelistet. Füge die hinzu, die du
   verfolgst; jedes wird ein Gerät.
3. Drücke **Prüfen**, um ESPN neu zu lesen und zu sehen, was die Integration über deine Teams weiß.

Ein Team spielt in mehreren Wettbewerben (Stade Toulousain: Top 14 und Champions Cup): Sein Gerät sammelt
die Spiele aller angekreuzten Wettbewerbe. Der Tabellenplatz kommt vom ersten Wettbewerb der Liste, der das
Team führt, die Liga vor dem Europapokal.

## Geräte

| Funktion           | Wert                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| Nächstes Spiel     | „Lyon – Stade Toulousain (Top 14)“, Heimteam zuerst                        |
| Anstoß             | Tag und Uhrzeit in der Zeitzone von Gladys (nur der Tag, falls nicht fest) |
| Spielort           | Stadion und Stadt, dazu der TV-Sender, wenn ESPN ihn liefert               |
| Letztes Ergebnis   | „Sieg 28-18 gegen Clermont Auvergne (Top 14)“                              |
| Tage bis zum Spiel | 0 am Spieltag, -1 wenn kein Spiel geplant ist                              |
| Spiel läuft        | 1 während eines Spiels                                                     |
| Spiel heute        | 1 am Spieltag                                                              |
| Punkte des Teams   | Während eines Spiels der Live-Stand, danach der Stand des letzten Spiels   |
| Punkte des Gegners | Ebenso, für den Gegner                                                     |
| Tabellenplatz      | Platz in der Liga oder in der Gruppe eines Pokals                          |

Die Namen der Funktionen werden beim Hinzufügen eines Teams festgelegt: ändere die Sprache, bevor du deine
Teams hinzufügst.

## Szenen

### Auslöser

- **Spiel beginnt bald**: 15, 30, 60 oder 120 Minuten vor dem geplanten Anstoß eines verfolgten Teams (nur
  wenn die Uhrzeit bekannt ist).
- **Anstoß**: wenn ESPN meldet, dass das Spiel begonnen hat, auf etwa eine Minute.
- **Spiel beendet**: wenn das Spiel vorbei ist. Sein Filter **Ergebnis** behält nur Siege, Unentschieden
  oder Niederlagen: wähle **Sieg** zum Feiern.

Lass **Team** leer, damit es für alle verfolgten Teams auslöst. Die Szene kann Team, Gegner, Wettbewerb,
Heim- oder Auswärtsspiel, Anstoßzeit, Spielort, Punktestände, Ergebnis und einen fertigen **Satz** lesen.

### Aktion

**Neuigkeiten eines Teams lesen** liefert eine Zusammenfassung, das nächste Spiel und das letzte Ergebnis
als Sätze, ob gerade ein Spiel läuft und die Tage bis zum nächsten Spiel. Sende sie in einer Nachricht oder
lass sie vorlesen.

## Dashboard

Das Widget **Rugby-Team** zeigt ein verfolgtes Team: den Live-Stand während eines Spiels, den Countdown zum
nächsten, den Tabellenplatz, die nächsten drei Spiele und das letzte Ergebnis. In seinen Einstellungen
wählst du das Team und kannst die nächsten Spiele oder das letzte Ergebnis ausblenden.

## Daten und Grenzen

- Die Daten kommen aus der öffentlichen JSON-API von ESPN (`site.api.espn.com`): kein Konto, kein
  Schlüssel. **Diese API ist weder offiziell noch dokumentiert**: Die API kann sich ohne Vorwarnung ändern oder
  verschwinden. Die Integration liest sie sparsam: die Teams einmal am Tag, die Spiele jedes Wettbewerbs alle
  6 Stunden (fünf Anfragen: letzter Monat bis drei Monate voraus), die Tabellen alle 6 Stunden und nach einem
  Spiel, und die Spiele des Tages **jede Minute nur während eines Spiels eines verfolgten Teams**, ab 5
  Minuten vor dem Anstoß.
- Spiele mehr als drei Monate voraus werden nicht gelesen: Im November erscheinen die nächsten Six Nations
  noch nicht.
- ESPN liefert die Teamnamen auf Englisch, ohne Akzente (Stade Francais Paris); Nationalteams werden
  übersetzt.
- Der TV-Sender wird beim europäischen Rugby selten geliefert.
- Kein Gladys-Kalender wird gefüllt: Eine Integration ist entweder eine Geräte- oder eine
  Kalender-Integration.
- Keine Verbindung zu ESPN, den Ligen oder den Vereinen.

## Fehlerbehebung

- **Kein Team im Tab „Entdecken“**: Kreuze mindestens einen Wettbewerb an und speichere, dann drücke
  **Prüfen**. Kann ESPN nicht gelesen werden, zeigt es der Status der Integration.
- **Ein Wert bleibt leer**: Die Integration rät nie; ein Tabellenplatz erscheint, sobald ESPN die Tabelle
  der Saison veröffentlicht.
- Protokolle: Die Integration protokolliert ihren Start und ihre Fehler; `LOG_LEVEL=debug` für jede Abfrage.
