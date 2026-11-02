import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { I18nService } from '@common/i18n/i18n.service';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';

describe('User request validation', () => {
  it('rejects null name and role while allowing phone to be cleared', async () => {
    const errors = await validate(
      plainToInstance(UpdateUserDto, { name: null, role: null, phone: null }),
    );
    expect(errors.map((e) => e.property).sort()).toEqual(['name', 'role']);
    expect(await validate(plainToInstance(UpdateUserDto, { phone: null }))).toEqual([]);
  });

  it('rejects passwords exceeding the bcrypt byte limit even below 72 characters', async () => {
    const body = {
      name: 'Valid Name',
      email: 'user@example.com',
      role: 'VIEWER',
      password: `Aa1${'ế'.repeat(24)}`,
    };
    const errors = await validate(plainToInstance(CreateUserDto, body));
    expect(errors.map((e) => e.property)).toContain('password');
    expect(
      await validate(plainToInstance(CreateUserDto, { ...body, password: 'ValidPass123' })),
    ).toEqual([]);
  });

  it('provides translated length errors in both supported languages', async () => {
    const errors = await validate(plainToInstance(UpdateUserDto, { name: 'A' }));
    expect(errors[0].constraints).toHaveProperty('isLength');
    const i18n = new I18nService();
    expect(i18n.t('validation.isLength', 'vi', { field: 'name' })).toBe(
      'Trường name có độ dài không hợp lệ.',
    );
    expect(i18n.t('validation.isLength', 'en', { field: 'name' })).toBe(
      'Field name has an invalid length.',
    );
  });
});
