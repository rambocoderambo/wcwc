import json, sys
d = json.load(sys.stdin)
names = set()
for m in d.get('matches', []):
    ht = m.get('homeTeam', {})
    at = m.get('awayTeam', {})
    if ht and ht.get('name'):
        names.add(ht['name'])
    if at and at.get('name'):
        names.add(at['name'])
print('Team names from API:')
for n in sorted(names):
    print(f'  {n}')
