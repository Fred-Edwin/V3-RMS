const buildUtcDateOnly = (year: number, month: number, day: number): Date => {
  return new Date(Date.UTC(year, month - 1, day));
};

export const parseDateOnly = (value: string): Date => {
  const [yearToken, monthToken, dayToken] = value.split('-');
  const year = Number(yearToken ?? '0');
  const month = Number(monthToken ?? '1');
  const day = Number(dayToken ?? '1');
  return buildUtcDateOnly(year, month, day);
};

export const formatDateOnly = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toIsoDateOnly = (value: Date): string => formatDateOnly(value);

export const getTodayDateOnly = (): Date => {
  const now = new Date();
  return buildUtcDateOnly(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

export const isSameDateOnly = (left: Date, right: Date): boolean => {
  return formatDateOnly(left) === formatDateOnly(right);
};
