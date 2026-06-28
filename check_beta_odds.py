import json, sys
d = json.load(sys.stdin)
m = d.get('data', {}).get('matchCards', [])
print('Match cards:', len(m))
for mc in m:
    h = mc.get('HOME_TEAM_NAME', '?')
    a = mc.get('AWAY_TEAM_NAME', '?')
    ah = mc.get('AH', {})
    if isinstance(ah, dict) and ah.get('odds'):
        print(h.ljust(30) + ' vs ' + a.ljust(30) + '  AH: ' + ah['odds'])
