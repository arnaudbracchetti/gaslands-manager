/**
 * Tests unitaires pour RolesGuard.
 *
 * On mock Reflector pour contrôler les métadonnées @Roles(...) renvoyées,
 * et ExecutionContext pour fournir req.user.
 */
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RolesGuard } from './roles.guard';
import { UserRole } from './user.entity';

const createContext = (role: UserRole): ExecutionContext => {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
  } as unknown as ExecutionContext;
};

describe('RolesGuard', () => {
  let guard: RolesGuard;
  const mockReflector = {
    getAllAndOverride: vi.fn(),
  };

  beforeEach(() => {
    guard = new RolesGuard(mockReflector as unknown as Reflector);
    vi.clearAllMocks();
  });

  it('autorise l\'accès si aucune métadonnée @Roles n\'est définie', () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext(UserRole.USER))).toBe(true);
  });

  it('autorise l\'accès si le rôle de l\'utilisateur correspond', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(createContext(UserRole.ADMIN))).toBe(true);
  });

  it('lève ForbiddenException si le rôle ne correspond pas', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(createContext(UserRole.USER))).toThrow(ForbiddenException);
  });
});
