import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../../common/domain/domain-error.js';
import { Prisma } from '../../../prisma/generated/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { IUserRepository } from '../application/user-repository.js';
import type { NewUser, User } from '../domain/user.js';

/** Prisma error code for a violated unique constraint. */
const UNIQUE_VIOLATION = 'P2002';

/**
 * Adapter of `IUserRepository`. The e-mail and the display name are `citext` columns with a unique index, so
 * "the same ignoring case" is decided by the database, also when two requests arrive at once (D-03, RN-COM-109).
 */
@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: NewUser): Promise<User> {
    try {
      const row = await this.prisma.user.create({
        data: {
          email: user.email,
          passwordHash: user.passwordHash,
          displayName: user.displayName,
        },
      });
      return { id: row.id, email: row.email, displayName: row.displayName, role: row.role };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictError(await this.whichIsTaken(user.email));
      }
      throw error;
    }
  }

  /** The e-mail wins when both are taken, so the answer does not depend on which index the database checks first. */
  private async whichIsTaken(email: string): Promise<'email-taken' | 'display-name-taken'> {
    const byEmail = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    return byEmail === null ? 'display-name-taken' : 'email-taken';
  }
}
