import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route (or a whole controller) as open to callers without a token. The JWT guard denies every other
 * route by default, so a new route is protected unless someone decides otherwise (SEC-API-02): only register,
 * login and health are public.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
