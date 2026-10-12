import type { Request } from 'express';

/** The signed-in person as the token carries them. Branch day reads everything else (department, branch) from the user row. */
export type Actor = NonNullable<Request['user']>;
