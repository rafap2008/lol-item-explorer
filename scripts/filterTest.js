const normalizeText = (s) => {
  const str = (s ?? '').toString();
  const decomposed = typeof str.normalize === 'function' ? str.normalize('NFD') : str;
  return decomposed
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^0-9a-zA-Z\s]/g, '')
    .toLowerCase()
    .trim();
};

const isSubsequence = (text, pattern) => {
  let i = 0, j = 0;
  while (i < text.length && j < pattern.length) {
    if (text[i] === pattern[j]) j++;
    i++;
  }
  return j === pattern.length;
};

const items = [
  { id: '1', name: 'Cabeça', plaintext: 'Cabeça descricao', description: '<p>Item cabeça</p>' },
  { id: '2', name: 'Espada', plaintext: 'Espada descricao', description: '<p>Item espada</p>' },
  { id: '3', name: 'Fiesta', plaintext: 'Fiesta', description: '<p>Party</p>' },
];

function filterItems(filter) {
  let sortableItems = [...items];
  if (filter) {
    const normalizedFilter = normalizeText(filter);
    sortableItems = sortableItems.filter((item) => {
      const name = normalizeText(item.name);
      const plaintext = normalizeText(item.plaintext);
      const descText = normalizeText(item.description?.replace(/<[^>]*>/g, ''));

      const exactMatch =
        name.includes(normalizedFilter) ||
        plaintext.includes(normalizedFilter) ||
        descText.includes(normalizedFilter);

      if (exactMatch) return true;

      if (normalizedFilter.length >= 3) {
        const subseqMatch =
          isSubsequence(name, normalizedFilter) ||
          isSubsequence(plaintext, normalizedFilter) ||
          isSubsequence(descText, normalizedFilter);
        if (subseqMatch) return true;
      }

      return false;
    });
  }
  return sortableItems;
}

console.log('Filter cabe:', filterItems('cabe'));
console.log("Filter '~cabe;a~':", filterItems('~cabe;a~'));
console.log('Filter fi est[a:', filterItems('fi est[a'));
console.log('Filter "e":', filterItems('e'));
console.log('Filter empty string returns all:', filterItems(''));
