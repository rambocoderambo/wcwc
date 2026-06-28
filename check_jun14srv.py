import json, sys
d = json.load(sys.stdin)
print('Source:', d.get('source'))
print('Total:', len(d.get('matches', [])))
for m in d.get('matches', []):
    dt = m.get('date', '')
    if dt and '2026-06-14' in dt:
        print(f'{m["home"]:25s} vs {m["away"]:25s}  {m.get("homeScore","-")}-{m.get("awayScore","-")}  [{m.get("status","")}]  src:{m.get("source","")}')
