// Compare API-Football times with MATCH_TIMES
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
const pairings = [[0,1],[2,3],[3,1],[0,2],[3,0],[1,2]];

// API data: [home, away, date, time]
const api = [
  ['Mexico','South Africa','2026-06-11','21:00'],
  ['South Korea','Czech Republic','2026-06-12','04:00'],
  ['Canada','Bosnia and Herzegovina','2026-06-12','21:00'],
  ['United States','Paraguay','2026-06-13','03:00'],
  ['Qatar','Switzerland','2026-06-13','21:00'],
  ['Germany','Curaçao','2026-06-14','19:00'],
  ['Haiti','Scotland','2026-06-14','03:00'],
  ['Australia','Turkey','2026-06-14','06:00'],
  ['Brazil','Morocco','2026-06-14','00:00'],
  ['Netherlands','Japan','2026-06-14','22:00'],
  ['Sweden','Tunisia','2026-06-15','04:00'],
  ['Spain','Cape Verde','2026-06-15','18:00'],
  ['Belgium','Egypt','2026-06-15','21:00'],
  ['Ivory Coast','Ecuador','2026-06-15','01:00'],
  ['Saudi Arabia','Uruguay','2026-06-16','00:00'],
  ['Iran','New Zealand','2026-06-16','03:00'],
  ['France','Senegal','2026-06-16','21:00'],
  ['Portugal','DR Congo','2026-06-17','19:00'],
  ['England','Croatia','2026-06-17','22:00'],
  ['Austria','Jordan','2026-06-17','06:00'],
  ['Iraq','Norway','2026-06-17','00:00'],
  ['Argentina','Algeria','2026-06-17','03:00'],
  ['Ghana','Panama','2026-06-18','01:00'],
  ['Uzbekistan','Colombia','2026-06-18','04:00'],
  ['Switzerland','Bosnia and Herzegovina','2026-06-18','21:00'],
  ['Czech Republic','South Africa','2026-06-18','18:00'],
  ['United States','Australia','2026-06-19','21:00'],
  ['Mexico','South Korea','2026-06-19','03:00'],
  ['Canada','Qatar','2026-06-19','00:00'],
  ['Germany','Ivory Coast','2026-06-20','22:00'],
  ['Scotland','Morocco','2026-06-20','00:00'],
  ['Brazil','Haiti','2026-06-20','02:30'],
  ['Turkey','Paraguay','2026-06-20','05:00'],
  ['Netherlands','Sweden','2026-06-20','19:00'],
  ['Spain','Saudi Arabia','2026-06-21','18:00'],
  ['Ecuador','Curaçao','2026-06-21','02:00'],
  ['Tunisia','Japan','2026-06-21','06:00'],
  ['Belgium','Iran','2026-06-21','21:00'],
  ['New Zealand','Egypt','2026-06-22','03:00'],
  ['France','Iraq','2026-06-22','23:00'],
  ['Argentina','Austria','2026-06-22','19:00'],
  ['Uruguay','Cape Verde','2026-06-22','00:00'],
  ['Portugal','Uzbekistan','2026-06-23','19:00'],
  ['England','Ghana','2026-06-23','22:00'],
  ['Norway','Senegal','2026-06-23','02:00'],
  ['Jordan','Algeria','2026-06-23','05:00'],
  ['Panama','Croatia','2026-06-24','01:00'],
  ['Colombia','DR Congo','2026-06-24','04:00'],
  ['Switzerland','Canada','2026-06-24','21:00'],
  ['Bosnia and Herzegovina','Qatar','2026-06-24','21:00'],
  ['Czech Republic','Mexico','2026-06-25','03:00'],
  ['Morocco','Haiti','2026-06-25','00:00'],
  ['Scotland','Brazil','2026-06-25','00:00'],
  ['South Africa','South Korea','2026-06-25','03:00'],
  ['Curaçao','Ivory Coast','2026-06-25','22:00'],
  ['Ecuador','Germany','2026-06-25','22:00'],
  ['Senegal','Iraq','2026-06-26','21:00'],
  ['Turkey','United States','2026-06-26','04:00'],
  ['Japan','Sweden','2026-06-26','01:00'],
  ['Norway','France','2026-06-26','21:00'],
  ['Paraguay','Australia','2026-06-26','04:00'],
  ['Tunisia','Netherlands','2026-06-26','01:00'],
  ['Panama','England','2026-06-27','23:00'],
  ['Cape Verde','Saudi Arabia','2026-06-27','02:00'],
  ['Egypt','Iran','2026-06-27','05:00'],
  ['New Zealand','Belgium','2026-06-27','05:00'],
  ['Uruguay','Spain','2026-06-27','02:00'],
  ['Croatia','Ghana','2026-06-27','23:00'],
  ['Algeria','Austria','2026-06-28','04:00'],
  ['Colombia','Portugal','2026-06-28','01:30'],
  ['Jordan','Argentina','2026-06-28','04:00'],
  ['DR Congo','Uzbekistan','2026-06-28','01:30'],
];

// Current MATCH_TIMES (MYT)
const currentMyt = [
  ['Jun 12 · 3:00 AM MYT','Jun 12 · 10:00 AM MYT','Jun 19 · 12:00 AM MYT','Jun 19 · 9:00 AM MYT','Jun 25 · 9:00 AM MYT','Jun 25 · 9:00 AM MYT'],
  ['Jun 13 · 3:00 AM MYT','Jun 14 · 3:00 AM MYT','Jun 19 · 3:00 AM MYT','Jun 19 · 6:00 AM MYT','Jun 25 · 3:00 AM MYT','Jun 25 · 3:00 AM MYT'],
  ['Jun 14 · 6:00 AM MYT','Jun 14 · 9:00 AM MYT','Jun 20 · 6:00 AM MYT','Jun 20 · 8:30 AM MYT','Jun 25 · 6:00 AM MYT','Jun 25 · 6:00 AM MYT'],
  ['Jun 13 · 9:00 AM MYT','Jun 14 · 12:00 PM MYT','Jun 20 · 3:00 AM MYT','Jun 20 · 11:00 AM MYT','Jun 26 · 10:00 AM MYT','Jun 26 · 10:00 AM MYT'],
  ['Jun 15 · 1:00 AM MYT','Jun 15 · 7:00 AM MYT','Jun 21 · 4:00 AM MYT','Jun 21 · 8:00 AM MYT','Jun 26 · 4:00 AM MYT','Jun 26 · 4:00 AM MYT'],
  ['Jun 15 · 4:00 AM MYT','Jun 15 · 10:00 AM MYT','Jun 21 · 1:00 AM MYT','Jun 21 · 12:00 PM MYT','Jun 26 · 7:00 AM MYT','Jun 26 · 7:00 AM MYT'],
  ['Jun 16 · 3:00 AM MYT','Jun 16 · 9:00 AM MYT','Jun 22 · 3:00 AM MYT','Jun 22 · 9:00 AM MYT','Jun 27 · 11:00 AM MYT','Jun 27 · 11:00 AM MYT'],
  ['Jun 16 · 12:00 AM MYT','Jun 16 · 6:00 AM MYT','Jun 22 · 12:00 AM MYT','Jun 22 · 6:00 AM MYT','Jun 27 · 8:00 AM MYT','Jun 27 · 8:00 AM MYT'],
  ['Jun 17 · 3:00 AM MYT','Jun 17 · 6:00 AM MYT','Jun 23 · 5:00 AM MYT','Jun 23 · 8:00 AM MYT','Jun 27 · 3:00 AM MYT','Jun 27 · 3:00 AM MYT'],
  ['Jun 17 · 9:00 AM MYT','Jun 17 · 12:00 PM MYT','Jun 23 · 1:00 AM MYT','Jun 23 · 11:00 AM MYT','Jun 28 · 10:00 AM MYT','Jun 28 · 10:00 AM MYT'],
  ['Jun 18 · 1:00 AM MYT','Jun 18 · 10:00 AM MYT','Jun 24 · 1:00 AM MYT','Jun 24 · 10:00 AM MYT','Jun 28 · 7:30 AM MYT','Jun 28 · 7:30 AM MYT'],
  ['Jun 18 · 4:00 AM MYT','Jun 18 · 7:00 AM MYT','Jun 24 · 4:00 AM MYT','Jun 24 · 7:00 AM MYT','Jun 28 · 5:00 AM MYT','Jun 28 · 5:00 AM MYT'],
];

function parseMyt(str) {
  const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const m = str.match(/(\w+)\s+(\d+)\s*·\s*(\d+):(\d+)\s*(AM|PM)\s*MYT/);
  if (!m) return null;
  let h = parseInt(m[3]);
  const min = parseInt(m[4]);
  if (m[5] === 'PM' && h !== 12) h += 12;
  if (m[5] === 'AM' && h === 12) h = 0;
  return new Date(2026, months[m[1]], parseInt(m[2]), h, min);
}

console.log('COMPARING API TIMES WITH MATCH_TIMES:');
console.log('Shows: Group M# | Teams | API date/time | MYT time | Diff (hours)');
console.log('---');

let apiIdx = 0;
for (let gi = 0; gi < groups.length; gi++) {
  for (let mi = 0; mi < 6; mi++) {
    const p = pairings[mi];
    const home = groups[gi].teams[p[0]];
    const away = groups[gi].teams[p[1]];
    const a = api[apiIdx];
    const mytStr = currentMyt[gi][mi];
    const mytDate = parseMyt(mytStr);
    
    // Parse API time as local (try interpreting as UTC for comparison)
    const apiDate = new Date(a[2] + 'T' + a[3] + ':00+00:00');
    
    if (mytDate) {
      const diffHours = (mytDate - apiDate) / 3600000;
      const matchKey = home + '|' + away;
      const apiKey = a[0] + '|' + a[1];
      
      if (matchKey === apiKey) {
        const apiLocal = a[2] + ' ' + a[3];
        const mytStr2 = mytDate.toLocaleString('en-US', {month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true,timeZone:'UTC'});
        // Check if diff is reasonable (like UTC to MYT = +8)
        // For matches in America, diff would be ~12-16 hours
        if (diffHours < 5 || diffHours > 20) {
          console.log('⚠️ ' + groups[gi].name + ' M' + mi + ': ' + home.padEnd(20) + ' vs ' + away.padEnd(20) + ' | API=' + apiLocal + ' | MYT=' + mytStr + ' | diff=' + diffHours.toFixed(1) + 'h');
        }
      }
    }
    apiIdx++;
  }
}
console.log('DONE');
