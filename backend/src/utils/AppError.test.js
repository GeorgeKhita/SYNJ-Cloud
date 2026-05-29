import { describe, it, expect } from 'vitest';
import { AppError } from './AppError.js';

describe('AppError', () => {
  it('crée une erreur 400 avec badRequest()', () => {
    const err = AppError.badRequest('Champ manquant');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.isOperational).toBe(true);
  });

  it('crée une erreur 401 avec unauthorized()', () => {
    const err = AppError.unauthorized();
    expect(err.statusCode).toBe(401);
  });

  it('crée une erreur 404 avec notFound()', () => {
    const err = AppError.notFound('Produit introuvable');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Produit introuvable');
  });
});
