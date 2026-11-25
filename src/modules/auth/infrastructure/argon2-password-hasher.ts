import { Injectable } from '@nestjs/common';
import { argon2id, hash } from 'argon2';
import type { IPasswordHasher } from '../application/password-hasher.js';

/**
 * Adapter of `IPasswordHasher`: argon2id with the second recommended setting of the OWASP Password Storage Cheat
 * Sheet (19 MiB of memory, 2 passes, 1 lane). The library adds a random salt and writes the parameters in the
 * hash, so they can be raised later without breaking the stored ones (SEC-WEB-04).
 */
@Injectable()
export class Argon2PasswordHasher implements IPasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, { type: argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  }
}
