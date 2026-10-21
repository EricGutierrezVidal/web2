# FutbolLab v4 — Champions i LaLiga (2026/27)

[Obrir la web](https://ericgutierrezvidal.github.io/web2/) · [GitHub Actions](https://github.com/EricGutierrezVidal/web2/actions)

Web independent d'anàlisi de futbol i simulació d'apostes **amb diners 100% virtuals**. No té relació comercial amb Bet365.

## Dades reals i sense ESPN/CORS al navegador

Les dades de partits i resultats de 2026/27 s'incorporen des de [open-matchday](https://github.com/oladeeayo/open-matchday), projecte informatiu no comercial que agrega diferents fonts obertes de partits. Només es publiquen dues competicions:

- `data/champions.json`: UEFA Champions League, incloent resultats i pròxims partits.
- `data/laliga.json`: LaLiga d'Espanya, incloent resultats i pròxims partits.

La web llegeix **fitxers locals a GitHub Pages** en comptes de fer peticions directes a ESPN des del navegador. Mostra la data de generació del proveïdor. No es fan passar dades antigues per marcadors en directe.

L'acció `.github/workflows/push.yml`:
1. Comprova sintaxi de JavaScript i Python.
2. Executa `scripts/sync_data.py` contra els fitxers CSV públics (4, 10, 16 i 22 UTC cada dia; GitHub pot retardar execucions programades).
3. Conserva l'última còpia disponible si falla l'actualització, sense sobreescriure-la amb zeros.
4. Valida els fitxers amb `tests/smoke.mjs`.
5. Publica únicament `futbol-lab/` a la branca `gh-pages`.

## Funcionalitats

- Llista de pròxims partits amb hora local, filtre per equip i mercat 1/X/2.
- Resultats confirmats amb gràfic de gols.
- Forma dels últims deu partits de cada equip, marcadors i goles a favor/en contra.
- Model **experimental** de Poisson només si les dades ho permeten (mínim 5 partits per equip i 20 resultats); usa gols reals, **no** xG, i no està validat per predir beneficis.
- Editor de quotes 1/X/2: l'usuari les copia de Bet365 o altres webs i es guarda la font declarada, hora i valor al navegador.
- Cupó combinat fins a 8 seleccions, saldo inicial **20 € virtuals**, retorn potencial i liquidació basada en marcadors confirmats, sense ingressos ni retirades.
- Importació JSON de partits i exportació JSON de cupons virtuals.

## Quotes reals de Bet365

**NO hi ha integració directa ni quotes en temps real.** Bet365 no proporciona una API pública. Per mostrar quotes actuals amb verificació i llicències, es necessitaria una clau d'un proveïdor autoritzat de quotes, com The Odds API o Odds-API.io, amb cobertura real de Bet365 i el cost que correspongui. Mai posis claus privades al JavaScript públic de GitHub Pages: s'han de guardar com a secrets i fer consultes al servidor.

La pissarra mostra xifres 1/X/2 només després d'introduir-les manualment; no s'inventen ni s'etiqueten com a directes.

## Limitacions

- La font pot arribar tard i tenir partits ajornats: comprova la data i la font.
- Les hores de les jornades llunyanes poden ser provisionals i apareixeran com «hora per confirmar».
- Els cupons estan guardats al `localStorage` del navegador (no se sincronitzen entre dispositius).
- Les apostes simulades no són recomanacions. El model no ofereix cap garantia de guany.
- No s'efectuen transaccions reals ni hi ha connexió a comptes d'apostes.

## Desenvolupament local

Executa un servidor estàtic a la carpeta `futbol-lab`, per exemple `python -m http.server 8000`, i obre http://localhost:8000/. No cal instal·lar dependències.

