interface PrepTimeRecord {
  claimedAt: Date | null;
  readyAt: Date | null;
}

interface ClockTimeRecord {
  clockInAt: Date | null;
  clockOutAt: Date | null;
}

interface ScheduledAssignmentRecord {
  shift: {
    startTime: string;
    endTime: string;
  };
}

interface RevenueOrderRecord {
  status: string;
  total: string | number;
}

const toMinutes = (milliseconds: number): number => milliseconds / 60000;

const toHours = (milliseconds: number): number => milliseconds / 3_600_000;

const roundToTwoDecimals = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const parseTimeToMinutes = (value: string): number => {
  const [hoursToken, minutesToken] = value.split(':');
  const hours = Number.parseInt(hoursToken ?? '0', 10);
  const minutes = Number.parseInt(minutesToken ?? '0', 10);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
};

const amountToMinorUnits = (amount: string | number): number => {
  const normalized = typeof amount === 'number' ? amount.toFixed(2) : amount;
  const [wholeToken = '0', fractionToken = '00'] = normalized.split('.');
  const whole = Number.parseInt(wholeToken, 10);
  const fraction = Number.parseInt(fractionToken.padEnd(2, '0').slice(0, 2), 10);

  if (!Number.isFinite(whole) || !Number.isFinite(fraction)) {
    return 0;
  }

  return whole * 100 + (whole >= 0 ? fraction : -fraction);
};

export const computeAveragePrepMinutes = (tickets: PrepTimeRecord[]): number => {
  const durations = tickets.flatMap((ticket) => {
    if (!ticket.claimedAt || !ticket.readyAt) {
      return [];
    }

    const diff = ticket.readyAt.getTime() - ticket.claimedAt.getTime();
    if (diff < 0) {
      return [];
    }

    return [toMinutes(diff)];
  });

  if (durations.length === 0) {
    return 0;
  }

  const total = durations.reduce((sum, value) => sum + value, 0);
  return Math.round(total / durations.length);
};

export const computeActualHours = (records: ClockTimeRecord[]): number => {
  const total = records.reduce((sum, record) => {
    if (!record.clockInAt || !record.clockOutAt) {
      return sum;
    }

    const diff = record.clockOutAt.getTime() - record.clockInAt.getTime();
    if (diff < 0) {
      return sum;
    }

    return sum + toHours(diff);
  }, 0);

  return roundToTwoDecimals(total);
};

export const computeScheduledHours = (assignments: ScheduledAssignmentRecord[]): number => {
  const totalMinutes = assignments.reduce((sum, assignment) => {
    const startMinutes = parseTimeToMinutes(assignment.shift.startTime);
    const endMinutes = parseTimeToMinutes(assignment.shift.endTime);

    if (endMinutes <= startMinutes) {
      return sum;
    }

    return sum + (endMinutes - startMinutes);
  }, 0);

  return roundToTwoDecimals(totalMinutes / 60);
};

export const computeClosedOrderRevenue = (orders: RevenueOrderRecord[]): string => {
  const totalMinorUnits = orders.reduce((sum, order) => {
    if (order.status !== 'CLOSED') {
      return sum;
    }

    return sum + amountToMinorUnits(order.total);
  }, 0);

  return (totalMinorUnits / 100).toFixed(2);
};

