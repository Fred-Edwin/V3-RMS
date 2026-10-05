const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function below1000(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest) {
    const tail = rest < 20 ? (ONES[rest] ?? '') : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ''}`;
    parts.push(hundreds ? `and ${tail}` : tail);
  }
  return parts.join(' ');
}

/** "Thirty thousand, one hundred and thirty-six shillings only" (cents, if any, are "and 50 cents"). */
export function amountInWords(amount: number): string {
  const whole = Math.floor(Math.round(amount * 100) / 100);
  const cents = Math.round((amount - whole) * 100);
  let text: string;
  if (whole === 0) text = 'zero';
  else {
    const groups: Array<[number, string]> = [
      [Math.floor(whole / 1_000_000), 'million'],
      [Math.floor(whole / 1000) % 1000, 'thousand'],
      [whole % 1000, ''],
    ];
    text = groups
      .filter(([n]) => n > 0)
      .map(([n, label]) => `${below1000(n)}${label ? ` ${label}` : ''}`)
      .join(', ');
  }
  const out = `${text.charAt(0).toUpperCase()}${text.slice(1)} shillings${cents ? ` and ${cents} cents` : ''} only`;
  return out;
}
