import { randomBytes } from 'node:crypto';

/** A random 12-character code for the QR on a letter (C24). It proves a paper is real; it opens nothing but the verify page. */
export const newVerifyCode = (): string => randomBytes(9).toString('base64url').slice(0, 12);
