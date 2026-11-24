import * as bcrypt from 'bcryptjs';

const PASSWORD_ROUNDS = 12;

export function hashMemberPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_ROUNDS);
}
