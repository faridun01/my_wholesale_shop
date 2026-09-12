import { describe, expect, it } from 'vitest';
import { validatePasswordStrength } from './auth.service.js';

describe('validatePasswordStrength', () => {
  it('accepts valid Latin passwords', () => {
    expect(() => validatePasswordStrength('StrongPass1')).not.toThrow();
    expect(() => validatePasswordStrength('Admin2026!')).not.toThrow();
  });

  it('accepts valid Cyrillic passwords', () => {
    expect(() => validatePasswordStrength('Пароль123')).not.toThrow();
    expect(() => validatePasswordStrength('Секрет2026')).not.toThrow();
  });

  it('rejects passwords shorter than minimum length', () => {
    expect(() => validatePasswordStrength('Abc1')).toThrow('минимум 8 символов');
  });

  it('rejects passwords without uppercase letters', () => {
    expect(() => validatePasswordStrength('password123')).toThrow('заглавные и строчные буквы');
    expect(() => validatePasswordStrength('пароль123')).toThrow('заглавные и строчные буквы');
  });

  it('rejects passwords without lowercase letters', () => {
    expect(() => validatePasswordStrength('PASSWORD123')).toThrow('заглавные и строчные буквы');
    expect(() => validatePasswordStrength('ПАРОЛЬ123')).toThrow('заглавные и строчные буквы');
  });

  it('rejects passwords without digits', () => {
    expect(() => validatePasswordStrength('PasswordOnly')).toThrow('хотя бы одну цифру');
    expect(() => validatePasswordStrength('ПарольТолько')).toThrow('хотя бы одну цифру');
  });
});
