import { UniqueConstraintError } from 'sequelize';

import { sequelize } from '../../db/sequelize.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { SequelizeAuthRepository } from './auth.repository.js';
import { registerSchema } from './auth.schemas.js';
import { AuthService } from './auth.service.js';

try {
  const [email, firstName, lastName] = process.argv.slice(2);
  if (process.stdin.isTTY || process.argv.length !== 5) {
    throw new Error('Expected account details as arguments and the password on stdin');
  }
  let password = '';
  for await (const chunk of process.stdin.setEncoding('utf8')) {
    if (typeof chunk !== 'string' || password.length + chunk.length > 130) {
      throw new Error('Invalid password input');
    }
    password += chunk;
  }
  const input = registerSchema.parse({
    email,
    firstName,
    lastName,
    password: password.replace(/\r?\n$/, ''),
  });
  await new AuthService(new SequelizeAuthRepository()).provisionAccount(input);
  console.log('Account created. Sign in through the normal login page.');
} catch (error) {
  const duplicate =
    error instanceof UniqueConstraintError ||
    (error instanceof HttpError && error.code === 'EMAIL_ALREADY_EXISTS');
  console.error(
    duplicate
      ? 'Account already exists.'
      : 'Account creation failed. Check the arguments, password requirements, and database.',
  );
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
