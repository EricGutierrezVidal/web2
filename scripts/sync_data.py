#!/usr/bin/env python3
"""Refresh published football snapshots from an attributed public match dataset.

Runs in GitHub Actions. Only Champions League & LaLiga, 2026/27.
No API secrets, no fabricated scores or prices. Keep previous snapshots on error.
"""
from __future__ import annotations
import csv
import datetime as dt
import io
import json
from pathlib import Path
import re
import sys
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
BASE="https://raw.githubusercontent.com/oladeeayo/open-matchday/master/"
SEASON="2627"
LEAGUES={"esp.1":("ESP_1_la-liga","laliga"),"uefa.champions":("UEFA_1_champions-league","champions")}

def get_text(path: str)->str:
    req=Request(BASE+path,headers={"User-Agent":"FutbolLab/4 (personal non-commercial statistics research)","Accept":"text/plain,application/json"})
    with urlopen(req,timeout=20) as res:
        return res.read(2_000_000).decode("utf-8-sig")

def slug(s: str)->str:
    import unicodedata
    s="".join(c for c in unicodedata.normalize("NFD",s.lower()) if unicodedata.category(c)!="Mn")
    return re.sub(r"[^a-z0-9]+","-",s).strip("-")

def event(league: str, row: dict, played: bool)->dict|None:
    home=(row.get("home") or "").strip()
    away=(row.get("away") or "").strip()
    date=(row.get("date") or "").strip()
    clock=(row.get("time") or "").strip()
    if not home or not away or not re.fullmatch(r"\d{4}-\d{2}-\d{2}",date):
        return None
    try: dt.date.fromisoformat(date)
    except ValueError: return None
    if not re.fullmatch(r"\d{2}:\d{2}",clock):clock="12:00"
    hs=rawint(row.get("ft_home")) if played else None
    aws=rawint(row.get("ft_away")) if played else None
    has_result=hs is not None and aws is not None
    return {
        "idEvent":f"{league}-{date}-{slug(home)}-{slug(away)}",
        "idHomeTeam":home,
        "idAwayTeam":away,
        "strHomeTeam":home,
        "strAwayTeam":away,
        "dateISO":f"{date}T{clock}:00Z",
        "intHomeScore":hs,
        "intAwayScore":aws,
        "played":has_result,
        "live":False,
        "status":"Final" if has_result else "Programat",
        "round":row.get("gw") or "",
        "source":"open-matchday",
        "shotsHome":rawint(row.get("home_shots")),
        "shotsAway":rawint(row.get("away_shots"))
    }

def rawint(x)->int|None:
    if x is None or str(x).strip()=="":return None
    try:return int(x)
    except ValueError:return None

def main():
    try:
        upstream=json.loads(get_text("build_summary.json"))["generated_utc"]
    except Exception as ex:
        print("WARNING: build-summary not available:",repr(ex),file=sys.stderr)
        upstream=None
    now=dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    failures=0
    for league,(folder,name) in LEAGUES.items():
        target=ROOT/"data"/f"{name}.json"
        try:
            results=list(csv.DictReader(io.StringIO(get_text(f"data/{folder}/results_{SEASON}.csv"))))
            fixtures=list(csv.DictReader(io.StringIO(get_text(f"data/{folder}/fixtures_{SEASON}.csv"))))
            if len(results)<20 or len(fixtures)<30:
                raise ValueError(f"Suspiciously short source: {len(results)} results / {len(fixtures)} fixtures")
            merged={}
            for row in results:
                ev=event(league,row,True)
                if ev:merged[ev["idEvent"]]=ev
            for row in fixtures:
                ev=event(league,row,False)
                if ev and ev["idEvent"] not in merged:merged[ev["idEvent"]]=ev
            ordered=sorted(merged.values(),key=lambda x:x["dateISO"])
            if len(ordered)<60:raise ValueError("Incomplete parsed dataset")
            snapshot={"version":1,"league":league,"season":"2026-27","source":"open-matchday","source_url":"https://github.com/oladeeayo/open-matchday","source_generated_utc":upstream,"records_generated_utc":now,"events":ordered}
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
            print(f"{name}: {sum(e['played'] for e in ordered)} results / {sum(not e['played'] for e in ordered)} fixtures; source={upstream}")
        except Exception as ex:
            failures+=1
            print(f"ERROR fetching {name}: {ex!r}; keeping last known snapshot",file=sys.stderr)
            if not target.is_file():raise
    if failures: print(f"{failures} source(s) failed; old data were retained.")

if __name__=="__main__":
    main()
