import json, sys
d = json.load(sys.stdin)
print('Total matches:', len(d.get('matches', [])))
for m in d.get('matches', []):
    h = m['homeTeam']['name']
    a = m['awayTeam']['name']
    s = m['score']['fullTime']
    st = m['status']
    hs = s['home'] if s else '-'
    a2 = s['away'] if s else '-'
    print(f'{h:30s} vs {a:30s}  {hs}-{a2}  [{st}]')
