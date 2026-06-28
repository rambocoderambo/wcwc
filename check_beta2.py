import json, sys
d = json.load(sys.stdin)
data = d.get('data', {})
# Check schedule window
sw = data.get('scheduleWindow', {})
print('scheduleWindow kind:', sw.get('kind'))
swm = sw.get('matches', [])
print('scheduleWindow matches:', len(swm))
for m in swm[:5]:
    ht = m.get('homeTeam', {})
    at = m.get('awayTeam', {})
    print(f'  {ht.get("name","?")} vs {at.get("name","?")}')

# Check matchCardWindow
mw = data.get('matchCardWindow', {})
print('\nmatchCardWindow kind:', mw.get('kind'))
mwm = mw.get('matches', [])
print('matchCardWindow matches:', len(mwm))
for m in mwm[:5]:
    ht = m.get('HOME_TEAM_NAME', '?')
    at = m.get('AWAY_TEAM_NAME', '?')
    ah = m.get('AH', {})
    print(f'  {ht} vs {at}  AH: {ah.get("odds","") if isinstance(ah,dict) else ""}')

# Check knockout
knockout = data.get('knockout', [])
print('\nKnockout rounds:', len(knockout))
for r in knockout:
    print(f'  {r.get("name","?")}')
    for s in r.get('standings', []):
        print(f'    {s.get("team",{}).get("name","?")}')
