import json, sys
d = json.load(sys.stdin)
odds = d.get('odds', [])
print('Total:', len(odds))
for o in odds[:10]:
    h = o['home'].ljust(25)
    a = o['away'].ljust(25)
    print(h + ' vs ' + a + '  ' + o['ah_line'])
