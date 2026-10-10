/** Lines for the refusals the real API sends to the head's phone, in the voice of the wording table (the owner may edit them). */
export const PHONE_REFUSAL_COPY = {
  /** 409 NO_DEPARTMENTS: the department was added after today's day began. */
  noDepartment: 'Your department joins the day tomorrow. Nothing to count today.',
  /** 404 on one past day: closed under the old flow (no figures in the new shape), or not a closed day of your department. */
  oldDay: 'There are no figures to show for this day. Days closed before the new Day screens have none.',
} as const;
