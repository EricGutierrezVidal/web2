# FutbolLab v2 — Champions League i LaLiga

Dashboard de futbol en català, sense servidor ni dependències. Publicat a GitHub Pages a https://ericgutierrezvidal.github.io/web2/.

## Funcionalitats
- Només UEFA Champions League i LaLiga d'Espanya.
- Calendari de la temporada i resultats des de l'API pública no oficial d'ESPN (si està disponible).
- Comparador visual dels últims 10 partits **de la mateixa competició** dels dos equips, amb V/E/D, GF, GC i mitjanes de gols.
- Gràfic de gols dels partits més recents.
- Model experimental de Poisson de gols i probabilitats 1X2: s'autoemplena només amb mínim de 5 partits per equip i 20 resultats de la competició. Estimació basada en gols marcats i encaixats, amb suavitzat; **no és xG i no està validada predictivament**.
- Entrada de quotes manuals, probabilitat implícita i valor esperat condicional al model.
- Simulacions de fins a 20 € i historial local editable (no permet apostar diners reals).
- Importació JSON de partits i exportació de simulacions.
- Caché local de dades (15 minuts); en cas de fallada, es marca clarament la còpia desada.

## Dades i limitacions
La font és https://site.api.espn.com/apis/site/v2/sports/soccer/{uefa.champions|esp.1}/scoreboard (API **no oficial**, sense garantia de continuïtat, CORS, actualització ni cobertura). Per recuperar molts partits s'utilitza un rang de temporada, amb fallback de consultes per trams quan la resposta és curta. El servei no ofereix quotes de cases d'apostes, xG verificat, lesions ni alineacions; aquests camps no s'inventen.

Les probabilitats no són garanties. **No et refiïs d'una aparent quota amb valor si el model no ha estat calibrat i validat amb proves fora de mostra.**

## Desenvolupament i desplegament
La web està a `futbol-lab/index.html` i `futbol-lab/app-v2.js`. Obre `index.html` amb Live Server o un servidor HTTP local. El workflow `.github/workflows/push.yml` executa `node --check` i publica només la carpeta `futbol-lab` a la branca `gh-pages` quan hi ha canvis a `main`.

## Format d'importació
Array JSON amb `strHomeTeam`, `strAwayTeam`, `dateEvent` (YYYY-MM-DD) o `dateISO`; per a resultats finalitzats, `intHomeScore` i `intAwayScore`. Es pot incloure `idHomeTeam`, `idAwayTeam`, `idEvent` i `strTime`.
