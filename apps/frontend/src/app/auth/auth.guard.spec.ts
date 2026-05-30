/**
 * Tests unitaires pour authGuard.
 * Note Vitest : vi.fn() remplace jest.fn().
 */

import { TestBed } from '@angular/core/testing';
import {
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { signal, computed } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  const createMockAuthService = (loggedIn: boolean) => ({
    currentUser: signal(loggedIn ? { id: 1, firstName: 'Jean', lastName: 'Dupont', email: 'jean@test.com', createdAt: '', updatedAt: '' } : null),
    isLoggedIn: computed(() => loggedIn),
    logout: vi.fn(),
  });

  const runGuard = (loggedIn: boolean) => {
    const mockRouter = {
      createUrlTree: vi.fn().mockReturnValue('/login-redirect'),
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: createMockAuthService(loggedIn) },
        { provide: Router, useValue: mockRouter },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

    return { result, mockRouter };
  };

  it('retourne true si l\'utilisateur est connecté', () => {
    const { result } = runGuard(true);
    expect(result).toBe(true);
  });

  it('redirige vers /login si l\'utilisateur n\'est pas connecté', () => {
    const { result, mockRouter } = runGuard(false);
    expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe('/login-redirect');
  });
});
