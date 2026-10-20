import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../../_shared';

/** An underlined text action (View, Correct, Remind, the help links): it answers hover and keyboard focus like every other control. */
export const LINK_BUTTON = cn('font-medium text-wds-text-ink underline underline-offset-2', MOTION, FOCUS_RING, onHover('text-wds-text-secondary'));
