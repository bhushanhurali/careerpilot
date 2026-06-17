/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { UserRole } from '../../db/models/user.model.js';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: UserRole;
      };
    }
  }
}

export {};
