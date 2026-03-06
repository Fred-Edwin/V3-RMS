export const BUSINESS_TIME_ZONE = 'Africa/Nairobi';

const getDatePartsInTimeZone = (value: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to format date in timezone ${timeZone}`);
  }

  return { year, month, day };
};

export const toYmdInTimeZone = (value: Date, timeZone = BUSINESS_TIME_ZONE): string => {
  const { year, month, day } = getDatePartsInTimeZone(value, timeZone);
  return `${year}-${month}-${day}`;
};

export const getTodayYmdInTimeZone = (
  value: Date = new Date(),
  timeZone = BUSINESS_TIME_ZONE,
): string => {
  return toYmdInTimeZone(value, timeZone);
};
