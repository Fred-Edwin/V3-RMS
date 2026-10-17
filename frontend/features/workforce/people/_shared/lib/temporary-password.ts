const WORDS = ['maji', 'kahawa', 'jua', 'mlima', 'simba', 'chai', 'pwani', 'nyota'];

/** "maji-kahawa-4721": two words and four digits, from the browser's random source. Shown once; the person must change it. */
export function generateTemporaryPassword(random: (n: number) => number = defaultRandom): string {
  const word = (): string => WORDS[random(WORDS.length)] ?? 'maji';
  return `${word()}-${word()}-${String(1000 + random(9000))}`;
}

function defaultRandom(max: number): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] ?? 0) % max;
}
