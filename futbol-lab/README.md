# FutbolLab

Dashboard estàtic de futbol en català: resultats i calendari via TheSportsDB (API pública amb limitacions), visualització de gols, comparador de quotes amb Poisson **manual i didàctic**, simulacions guardades amb localStorage i importació/exportació JSON.

## Ús
Obre `index.html` en un servidor estàtic (per exemple VS Code Live Server). No cal instal·lar dependències. Per GitHub Pages, publica la carpeta `futbol-lab` a través d'una branca de publicació o mou el contingut a l'arrel del lloc.

## Limitacions
- No s'inventa cap partit, xG, quota, alineació o probabilitat predictiva.
- El pla gratuït de l'API de TheSportsDB pot retornar molt pocs resultats i pot fallar per CORS/rate limit. En aquest cas importa un JSON.
- Els λ del model Poisson s'introdueixen manualment; no estan calibrats amb resultats dels equips i **no són recomanacions d'aposta**.
- El registre és de simulacions, no efectua apostes reals. Les dades s'emmagatzemen només en aquest navegador.

Font: https://www.thesportsdb.com/docs_api_guide.php
