const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async () => {
  const data = await fetchJson('https://ddragon.leagueoflegends.com/cdn/15.14.1/data/en_US/item.json');
  const items = Object.values(data.data);
  const headNames = ["Rabadon's Deathcap", "Spectre's Cowl", "Wooglet's Witchcap", "Hollow Radiance", "Jak'Sho, The Protean"];
  for (const item of items) {
    if (headNames.includes(item.name)) {
      console.log('==', item.name, '==');
      console.log(item.description);
      console.log('\n----\n');
    }
  }
})();
