/**
 * Tests unitaires pour adminGuard.
 * Mirroir de auth.guard.spec.ts.
 */

import { TestBed } from '@angular/core/testing';
import {
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { signal, computed } from '@angular/core';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';

describe('adminGuard', () => {
  const createMockAuthService = (role: 'user' | 'admin' | null) => ({
    currentUser: signal(
      role
        ? { id: 1, firstName: 'Jean', lastName: 'Dupont', email: 'jean@test.com', role, isActive: true, createdAt: '', updatedAt: '' }
        : null,
    ),
    isLoggedIn: computed(() => role !== null),
    logout: vi.fn(),
  });

  const runGuard = (role: 'user' | 'admin' | null) => {
    const mockRouter = {
      createUrlTree: vi.fn().mockReturnValue('/home-redirect'),
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: createMockAuthService(role) },
        { provide: Router, useValue: mockRouter },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      adminGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

    return { result, mockRouter };
  };

  it('retourne true si l\'utilisateur connecté est admin', () => {
    const { result } = runGuard('admin');
    expect(result).toBe(true);
  });

  it('redirige vers /home si l\'utilisateur connecté n\'est pas admin', () => {
    const { result, mockRouter } = runGuard('user');
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/home']);
    expect(result).toBe('/home-redirect');
  });

  it('redirige vers /home si personne n\'est connecté', () => {
    const { result, mockRouter } = runGuard(null);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/home']);
    expect(result).toBe('/home-redirect');
  });
});
