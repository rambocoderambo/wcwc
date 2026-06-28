import json, sys
d = json.load(sys.stdin)
data = d.get('data', {})
print('Keys:', list(data.keys()))
for k in data:
    v = data[k]
    if isinstance(v, dict) and 'matches' in v:
        print(f'{k}: kind={v.get("kind","?")} matches={len(v.get("matches",[]))}')
    elif isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
        if 'HOME_TEAM_NAME' in v[0]:
            print(f'{k}: {len(v)} match cards')
            for mc in v:
                ah = mc.get('AH', {})
                if isinstance(ah, dict):
                    print(f'  {mc.get("HOME_TEAM_NAME","?")} vs {mc.get("AWAY_TEAM_NAME","?")}  AH: {ah.get("odds","")}')
