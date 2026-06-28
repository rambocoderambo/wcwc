import json, sys
d = json.load(sys.stdin)
print('count:', d.get('resultSet', {}).get('count'))
for m in d.get('matches', []):
    ht = m.get('homeTeam') or {}
    at = m.get('awayTeam') or {}
    h = ht.get('name') or 'TBD'
    a = at.get('name') or 'TBD'
    utc = m.get('utcDate') or '?'
    st = m.get('status') or '?'
    stage = m.get('stage') or '?'
    print(f'{h:25s} vs {a:25s}  {utc[:19]:19s}  [{st:10s}]  {stage}')
