import { redirect } from 'next/navigation';

export default function ClockPage(): never {
  redirect('/app/shifts');
}
