const groups = [
  {name:'A',teams:['Mexico','South Africa','South Korea','Czech Republic']},
  {name:'B',teams:['Canada','Bosnia and Herzegovina','Qatar','Switzerland']},
  {name:'C',teams:['Brazil','Morocco','Haiti','Scotland']},
  {name:'D',teams:['United States','Paraguay','Australia','Turkey']},
  {name:'E',teams:['Germany','Curaçao','Ivory Coast','Ecuador']},
  {name:'F',teams:['Netherlands','Japan','Sweden','Tunisia']},
  {name:'G',teams:['Belgium','Egypt','Iran','New Zealand']},
  {name:'H',teams:['Spain','Cape Verde','Saudi Arabia','Uruguay']},
  {name:'I',teams:['France','Senegal','Iraq','Norway']},
  {name:'J',teams:['Argentina','Algeria','Austria','Jordan']},
  {name:'K',teams:['Portugal','DR Congo','Uzbekistan','Colombia']},
  {name:'L',teams:['England','Croatia','Ghana','Panama']}
];

// Correct order from AsianBookie (by date across groups)
const correct = [
  'Mexico|South Africa', 'South Korea|Czech Republic',
  'Canada|Bosnia and Herzegovina', 'United States|Paraguay',
  'Qatar|Switzerland', 'Brazil|Morocco',
  'Haiti|Scotland', 'Australia|Turkey',
  'Germany|Curaçao', 'Netherlands|Japan',
  'Ivory Coast|Ecuador', 'Sweden|Tunisia',
  'Spain|Cape Verde', 'Belgium|Egypt',
  'Saudi Arabia|Uruguay', 'Iran|New Zealand',
  'France|Senegal', 'Iraq|Norway',
  'Argentina|Algeria', 'Austria|Jordan',
  'Portugal|DR Congo', 'England|Croatia',
  'Ghana|Panama', 'Uzbekistan|Colombia',
  'Czech Republic|South Africa', 'Switzerland|Bosnia and Herzegovina',
  'Canada|Qatar', 'Mexico|South Korea',
  'United States|Australia', 'Scotland|Morocco',
  'Brazil|Haiti', 'Turkey|Paraguay',
  'Netherlands|Sweden', 'Germany|Ivory Coast',
  'Ecuador|Curaçao', 'Tunisia|Japan',
  'Spain|Saudi Arabia', 'Belgium|Iran',
  'Uruguay|Cape Verde', 'New Zealand|Egypt',
  'Argentina|Austria', 'France|Iraq',
  'Norway|Senegal', 'Jordan|Algeria',
  'Portugal|Uzbekistan', 'England|Ghana',
  'Panama|Croatia', 'Colombia|DR Congo',
  'Bosnia and Herzegovina|Qatar', 'Switzerland|Canada',
  'Morocco|Haiti', 'Scotland|Brazil',
  'Czech Republic|Mexico', 'South Africa|South Korea',
  'Curaçao|Ivory Coast', 'Ecuador|Germany',
  'Japan|Sweden', 'Tunisia|Netherlands',
  'Paraguay|Australia', 'Turkey|United States',
  'Norway|France', 'Senegal|Iraq',
  'Cape Verde|Saudi Arabia', 'Uruguay|Spain',
  'Egypt|Iran', 'New Zealand|Belgium',
  'Croatia|Ghana', 'Panama|England',
  'Colombia|Portugal', 'DR Congo|Uzbekistan',
  'Algeria|Austria', 'Jordan|Argentina',
];

// Build the correct PAIRINGS by finding which team indices produce the correct home/away for each group
// Since PAIRINGS is shared across all groups, we need indices that work for ALL groups
// The pattern: matches 0-1 use indices 0,1 and 2,3; matches 2-3 use 3,1 and 0,2; matches 4-5 use 3,0 and 1,2

const newPairings = [[0,1],[2,3],[3,1],[0,2],[3,0],[1,2]];
const oldPairings = [[0,1],[2,3],[1,3],[0,2],[3,0],[2,1]];

console.log('=== OLD PAIRINGS ===');
let oldErrors = 0;
groups.forEach((g, gi) => {
  for (let m = 0; m < 6; m++) {
    const p = oldPairings[m];
    const home = g.teams[p[0]];
    const away = g.teams[p[1]];
    const current = home + '|' + away;
    const expected = correct[gi * 6 + m];
    if (current !== expected) {
      console.log('Group ' + g.name + ' M' + m + ': ' + current + '  SHOULD BE ' + expected);
      oldErrors++;
    }
  }
});
console.log('Old errors: ' + oldErrors);

console.log('');
console.log('=== NEW PAIRINGS ===');
let newErrors = 0;
groups.forEach((g, gi) => {
  for (let m = 0; m < 6; m++) {
    const p = newPairings[m];
    const home = g.teams[p[0]];
    const away = g.teams[p[1]];
    const current = home + '|' + away;
    const expected = correct[gi * 6 + m];
    if (current !== expected) {
      console.log('Group ' + g.name + ' M' + m + ': ' + current + '  SHOULD BE ' + expected);
      newErrors++;
    }
  }
});
if (newErrors === 0) console.log('ALL CORRECT!');
else console.log('New errors: ' + newErrors);
