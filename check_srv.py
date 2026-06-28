import json, sys
d = json.load(sys.stdin)
print('Source:', d.get('source'))
print('Total:', len(d.get('matches', [])))
print('--- Haiti matches ---')
for m in d.get('matches', []):
    if 'haiti' in m['home'].lower() or 'haiti' in m['away'].lower():
        print(f'{m["home"]:25s} vs {m["away"]:25s}  {m.get("homeScore","-")}-{m.get("awayScore","-")}  [{m.get("status","")}]  src:{m.get("source","")}')
print('--- Next matches ---')
for m in d.get('matches', []):
    if m.get('status') == 'UPCOMING' or m.get('status') == 'TIMED':
        print(f'{m["home"]:25s} vs {m["away"]:25s}  {m.get("homeScore","-")}-{m.get("awayScore","-")}  [{m.get("status","")}]  src:{m.get("source","")}')
