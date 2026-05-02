import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { LoginDto, RegisterDto } from '@/auth/dto/auth.dto';
import { Role } from '@/auth/enums/role.enum';

const BASE_LOGIN = { email: 'test@example.com', password: 'password123' };
const BASE_REGISTER = {
  email: 'test@example.com',
  password: 'password123',
  name: 'João Silva',
  role: Role.ADMIN,
};
const SHORT_PASSWORD = '1234567';
const INVALID_EMAIL = 'email-invalido';
const INVALID_ROLE = 'invalid-role' as unknown as Role;

describe('AuthDto', () => {
  describe('LoginDto', () => {
    it('deve criar LoginDto com dados válidos', () => {
      const loginDto = plainToClass(LoginDto, BASE_LOGIN);
      expect(loginDto.email).toBe('test@example.com');
      expect(loginDto.password).toBe('password123');
    });

    it('deve validar email obrigatório', async () => {
      const loginDto = plainToClass(LoginDto, { password: BASE_LOGIN.password });
      const errors = await validate(loginDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('deve validar formato de email', async () => {
      const loginDto = plainToClass(LoginDto, { ...BASE_LOGIN, email: INVALID_EMAIL });
      const errors = await validate(loginDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('deve validar password obrigatório', async () => {
      const loginDto = plainToClass(LoginDto, { email: BASE_LOGIN.email });
      const errors = await validate(loginDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('deve validar tamanho mínimo da password', async () => {
      const loginDto = plainToClass(LoginDto, { ...BASE_LOGIN, password: SHORT_PASSWORD });
      const errors = await validate(loginDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('deve passar na validação com dados corretos', async () => {
      const loginDto = plainToClass(LoginDto, BASE_LOGIN);
      const errors = await validate(loginDto);
      expect(errors.length).toBe(0);
    });
  });

  describe('RegisterDto', () => {
    it('deve criar RegisterDto com dados válidos', () => {
      const registerDto = plainToClass(RegisterDto, BASE_REGISTER);
      expect(registerDto.email).toBe('test@example.com');
      expect(registerDto.password).toBe('password123');
      expect(registerDto.name).toBe('João Silva');
      expect(registerDto.role).toBe(Role.ADMIN);
    });

    it('deve validar email obrigatório', async () => {
      const registerDto = plainToClass(RegisterDto, {
        password: BASE_REGISTER.password,
        name: BASE_REGISTER.name,
        role: BASE_REGISTER.role,
      });
      const errors = await validate(registerDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('deve validar formato de email', async () => {
      const registerDto = plainToClass(RegisterDto, { ...BASE_REGISTER, email: INVALID_EMAIL });
      const errors = await validate(registerDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('deve validar password obrigatório', async () => {
      const registerDto = plainToClass(RegisterDto, {
        email: BASE_REGISTER.email,
        name: BASE_REGISTER.name,
        role: BASE_REGISTER.role,
      });
      const errors = await validate(registerDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('deve validar tamanho mínimo da password', async () => {
      const registerDto = plainToClass(RegisterDto, { ...BASE_REGISTER, password: SHORT_PASSWORD });
      const errors = await validate(registerDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('deve validar name obrigatório', async () => {
      const registerDto = plainToClass(RegisterDto, {
        email: BASE_REGISTER.email,
        password: BASE_REGISTER.password,
        role: BASE_REGISTER.role,
      });
      const errors = await validate(registerDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
    });

    it('deve validar valores permitidas para role', async () => {
      const registerDto = plainToClass(RegisterDto, { ...BASE_REGISTER, role: INVALID_ROLE });
      const errors = await validate(registerDto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('role');
    });

    it('deve aceitar role "ADMIN"', async () => {
      const registerDto = plainToClass(RegisterDto, BASE_REGISTER);
      const errors = await validate(registerDto);
      expect(errors.length).toBe(0);
    });

    it('deve aceitar role "RECEPCIONISTA"', async () => {
      const registerDto = plainToClass(RegisterDto, { ...BASE_REGISTER, role: Role.RECEPCIONISTA });
      const errors = await validate(registerDto);
      expect(errors.length).toBe(0);
    });

    it('deve aceitar role "MECANICO"', async () => {
      const registerDto = plainToClass(RegisterDto, { ...BASE_REGISTER, role: Role.MECANICO });
      const errors = await validate(registerDto);
      expect(errors.length).toBe(0);
    });

    it('deve aceitar RegisterDto sem role (opcional)', async () => {
      const registerDto = plainToClass(RegisterDto, {
        email: BASE_REGISTER.email,
        password: BASE_REGISTER.password,
        name: BASE_REGISTER.name,
      });
      const errors = await validate(registerDto);
      expect(errors.length).toBe(0);
      expect(registerDto.role).toBeUndefined();
    });

    it('deve passar na validação com dados corretos', async () => {
      const registerDto = plainToClass(RegisterDto, BASE_REGISTER);
      const errors = await validate(registerDto);
      expect(errors.length).toBe(0);
    });
  });
});
