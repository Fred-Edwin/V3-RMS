export const formatCurrency = (value: string | number | null | undefined): string => {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
};

export const formatPayPeriod = (payPeriod: string): string => {
  const [year, month] = payPeriod.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  if (Number.isNaN(date.getTime())) return payPeriod;
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(date);
};

export const formatShortDate = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

export const formatLongDate = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));

export const monthInputValue = (value?: string): string => value ?? '';
