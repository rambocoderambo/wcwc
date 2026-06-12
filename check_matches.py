import json, sys
data = json.load(sys.stdin)
print('Source:', data.get('source', '?'))
print('Matches:', len(data.get('matches', [])))
for m in data.get('matches', [])[:5]:
    h = m['home'].ljust(25)
    a = m['away'].ljust(25)
    hs = m.get('homeScore', '')
    a2 = m.get('awayScore', '')
    print(f'{h} vs {a}  {hs}-{a2}  [{m.get("status","")}]')
