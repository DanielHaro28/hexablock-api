import { createServer, type Server, type Socket } from 'node:net';
import { afterAll, describe, expect, it } from '@jest/globals';
import type { AppConfig } from '../../../src/common/config/app-config.js';
import { PrismaHealthProbe } from '../../../src/modules/health/infrastructure/prisma-health-probe.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const services: PrismaService[] = [];

/** A PrismaService for a given URL; only `databaseUrl` matters to it. */
function prismaFor(databaseUrl: string): PrismaService {
  const service = new PrismaService({ databaseUrl } as AppConfig);
  services.push(service);
  return service;
}

describe('RF-92 · PrismaHealthProbe', () => {
  afterAll(async () => {
    await Promise.all(services.map((service) => service.$disconnect()));
  });

  it('should_report_available_when_the_database_answers', async () => {
    // Arrange
    const probe = new PrismaHealthProbe(prismaFor(process.env.DATABASE_URL ?? ''));

    // Act
    const available = await probe.isDatabaseAvailable();

    // Assert
    expect(available).toBe(true);
  });

  it('should_report_not_available_without_throwing_when_the_database_cannot_be_reached', async () => {
    // Arrange: nothing listens on port 1
    const probe = new PrismaHealthProbe(prismaFor('postgresql://nobody:nothing@127.0.0.1:1/none'));

    // Act
    const available = await probe.isDatabaseAvailable();

    // Assert
    expect(available).toBe(false);
  });

  it('should_report_not_available_within_the_timeout_when_the_database_accepts_but_never_answers', async () => {
    // Arrange: a server that accepts the TCP connection and stays silent, like a host that drops packets
    const sockets: Socket[] = [];
    const silent: Server = createServer((socket) => sockets.push(socket));
    await new Promise<void>((done) => silent.listen(0, '127.0.0.1', done));
    const { port } = silent.address() as { port: number };
    const probe = new PrismaHealthProbe(
      prismaFor(`postgresql://nobody:nothing@127.0.0.1:${port}/none`),
      200,
    );
    const startedAt = Date.now();

    // Act
    const available = await probe.isDatabaseAvailable();
    sockets.forEach((socket) => socket.destroy());
    await new Promise((done) => silent.close(done));

    // Assert
    expect(available).toBe(false);
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });
});
