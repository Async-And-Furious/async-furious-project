import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { LoginDto, RegisterDto } from '@/auth/dto/auth.dto';
import { Role } from '@/auth/enums/role.enum';

describe('AuthDto', () => {
  describe('LoginDto', () => {
    it('deve criar LoginDto com dados válidos', () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const loginDto = plainToClass(LoginDto, loginData);

      expect(loginDto.email).toBe('test@example.com');
      expect(loginDto.password).toBe('password123');
    });

    it('deve validar email obrigatório', async () => {
      const loginData = {
        password: 'password123',
      };

      const loginDto = plainToClass(LoginDto, loginData);
      const errors = await validate(loginDto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('deve validar formato de email', async () => {
      const loginData = {
        email: 'email-invalido',
        password: 'password123',
      };

      const loginDto = plainToClass(LoginDto, loginData);
      const errors = await validate(loginDto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('deve validar password obrigatório', async () => {
      const loginData = {
        email: 'test@example.com',
      };

      const loginDto = plainToClass(LoginDto, loginData);
      const errors = await validate(loginDto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('deve validar tamanho mínimo da password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: '1234567', // 7 caracteres - menor que o mínimo de 8
      };

      const loginDto = plainToClass(LoginDto, loginData);
      const errors = await validate(loginDto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('deve passar na validação com dados corretos', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const loginDto = plainToClass(LoginDto, loginData);
      const errors = await validate(loginDto);

      expect(errors.length).toBe(0);
    });
  });

  describe('RegisterDto', () => {
    it('deve criar RegisterDto com dados válidos', () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'João Silva',
        role: Role.ADMIN,
      };

      const registerDto = plainToClass(RegisterDto, registerData);

      expect(registerDto.email).toBe('test@example.com');
      expect(registerDto.password).toBe('password123');
      expect(registerDto.name).toBe('João Silva');
      expect(registerDto.role).toBe(Role.ADMIN);
    });

    it('deve validar email obrigatório', async () => {
      const registerData = {
        password: 'password123',
        name: 'João Silva',
        role: Role.ADMIN,
      };

      const registerDto = plainToClass(RegisterDto, registerData);
      const errors = await validate(registerDto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('deve validar formato de email', async () => {
      const registerData = {
        email: 'email-invalido',
        password: 'password123',
        name: 'João Silva',
        role: Role.ADMIN,
      };

      const registerDto = plainToClass(RegisterDto, registerData);
      const errors = await validate(registerDto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('deve validar password obrigatório', async () => {
      const registerData = {
        email: 'test@example.com',
        name: 'João Silva',
        role: Role.ADMIN,
      };

      const registerDto = plainToClass(RegisterDto, registerData);
      const errors = await validate(registerDto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('deve validar tamanho mínimo da password', async () => {
      const registerData = {
        email: 'test@example.com',
        password: '1234567', // 7 caracteres - menor que o mínimo de 8
        name: 'João Silva',
        role: Role.ADMIN,
      };

      const registerDto = plainToClass(RegisterDto, registerData);
      const errors = await validate(registerDto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('password');
    });

    it('deve validar name obrigatório', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        role: Role.ADMIN,
      };

      const registerDto = plainToClass(RegisterDto, registerData);
      const errors = await validate(registerDto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('name');
    });

    it('deve validar valores permitidos para role', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'João Silva',
        role: 'invalid-role' as unknown as Role,
      };

      const registerDto = plainToClass(RegisterDto, registerData);
      const errors = await validate(registerDto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('role');
    });

    it('deve aceitar role "ADMIN"', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'João Silva',
        role: Role.ADMIN,
      };

      const registerDto = plainToClass(RegisterDto, registerData);
      const errors = await validate(registerDto);

      expect(errors.length).toBe(0);
    });

    it('deve aceitar role "RECEPCIONISTA"', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'João Silva',
        role: Role.RECEPCIONISTA,
      };

      const registerDto = plainToClass(RegisterDto, registerData);
      const errors = await validate(registerDto);

      expect(errors.length).toBe(0);
    });

    it('deve aceitar role "MECANICO"', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'João Silva',
        role: Role.MECANICO,
      };

      const registerDto = plainToClass(RegisterDto, registerData);
      const errors = await validate(registerDto);

      expect(errors.length).toBe(0);
    });

    it('deve aceitar RegisterDto sem role (opcional)', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'João Silva',
      };

      const registerDto = plainToClass(RegisterDto, registerData);
      const errors = await validate(registerDto);

      expect(errors.length).toBe(0);
      expect(registerDto.role).toBeUndefined();
    });

    it('deve passar na validação com dados corretos', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'João Silva',
        role: Role.ADMIN,
      };

      const registerDto = plainToClass(RegisterDto, registerData);
      const errors = await validate(registerDto);

      expect(errors.length).toBe(0);
    });
  });
});
