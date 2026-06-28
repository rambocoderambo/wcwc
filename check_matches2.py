import json, sys
d = json.load(sys.stdin)
print('Source:', d.get('source'))
print('Matches:', len(d.get('matches', [])))
for m in d.get('matches', [])[:5]:
    h = m.get('home', '?').ljust(25)
    a = m.get('away', '?').ljust(25)
    hs = m.get('homeScore', '-')
    a2 = m.get('awayScore', '-')
    st = m.get('status', '')
    src = m.get('source', '')
    print(f'{h} vs {a}  {hs}-{a2}  [{st}]  {src}')
