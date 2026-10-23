export type DeviceWord = 'computer' | 'phone';

/** What the Notifications row says, from this browser's own permission (frames 13.3 and 13.14: "Off on this computer", "Off on this phone"). */
export function notificationsLine(permission: NotificationPermission | 'unsupported', registering: boolean, device: DeviceWord): string {
  if (registering) return 'Turning on…';
  if (permission === 'granted') return `On, on this ${device}`;
  if (permission === 'denied') return `Blocked in this browser. Allow notifications for this site in its settings.`;
  if (permission === 'unsupported') return `Not available on this ${device}`;
  return `Off on this ${device}`;
}

export interface PasswordFormValues {
  current: string;
  next: string;
  again: string;
}

export interface PasswordErrors {
  current?: string;
  next?: string;
  again?: string;
}

/** The dialog's own checks before the server's: all three filled, 8 characters or more, the two new ones match, and it is a new one. */
export function checkPasswordChange(v: PasswordFormValues): PasswordErrors {
  const errors: PasswordErrors = {};
  if (v.current === '') errors.current = 'Enter your current password.';
  if (v.next.length < 8) errors.next = 'Use at least 8 characters.';
  else if (v.next === v.current) errors.next = 'Choose a password you have not used just now.';
  if (v.again !== v.next) errors.again = 'The two passwords are different.';
  return errors;
}
