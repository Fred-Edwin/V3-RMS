import bcrypt from 'bcryptjs';
import { env } from '../config/env';

export const hashPassword = async (plain: string): Promise<string> => {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
};

export const comparePassword = async (plain: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(plain, hash);
};

/** Same bcrypt hashing as passwords, applied to the 4-digit numeric PIN column. */
export const hashPin = async (pin: string): Promise<string> => {
  return bcrypt.hash(pin, env.BCRYPT_ROUNDS);
};

export const comparePin = async (pin: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(pin, hash);
};
