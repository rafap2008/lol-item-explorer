const normalizeText = (s) => {
  const str = (s ?? '').toString();
  const decomposed = typeof str.normalize === 'function' ? str.normalize('NFD') : str;
  return decomposed
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^0-9a-zA-Z\s]/g, '')
    .toLowerCase()
    .trim();
};

const tests = [
  'cabeça',
  'cabeça',
  'Cabeça',
  '~cabe;a~',
  'fi est[a',
  "~cabe;a~ fi est[a funcionando corretamente",
  'n\'ao consigo filtrar',
  'cabe;a',
  'cabe a',
];

tests.forEach(t => console.log(JSON.stringify(t), '->', normalizeText(t)));

// subsequence test
const isSubsequence = (text, pattern) => {
  let i = 0, j = 0;
  while (i < text.length && j < pattern.length) {
    if (text[i] === pattern[j]) j++;
    i++;
  }
  return j === pattern.length;
};

const sampleName = 'cabeça';
const sampleFilter = '~cabe;a~';
const nName = normalizeText(sampleName);
const nFilter = normalizeText(sampleFilter);
console.log('\nSample name:', sampleName, '->', nName);
console.log('Sample filter:', sampleFilter, '->', nFilter);
console.log('includes:', nName.includes(nFilter));
console.log('subsequence:', isSubsequence(nName, nFilter));

