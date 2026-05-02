import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { LoginDto, RegisterDto } from '@/auth/dto/auth.dto';
import { Role } from '@/auth/enums/role.enum';

const VALID_LOGIN = { email: 'test@example.com', password: 'password123' };
const VALID_REGISTER = { ...VALID_LOGIN, name: 'João Silva', role: Role.ADMIN };

async function expectFieldError<T extends object>(
  DtoClass: new () => T,
  data: object,
  property: string
): Promise<void> {
  const dto = plainToClass(DtoClass, data);
  const errors = await validate(dto as object);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0].property).toBe(property);
}

async function expectNoErrors<T extends object>(
  DtoClass: new () => T,
  data: object
): Promise<void> {
  const dto = plainToClass(DtoClass, data);
  const errors = await validate(dto as object);
  expect(errors.length).toBe(0);
}

describe('AuthDto', () => {
  describe('LoginDto', () => {
    it('deve criar LoginDto com dados válidos', () => {
      const dto = plainToClass(LoginDto, VALID_LOGIN);

      expect(dto.email).toBe(VALID_LOGIN.email);
      expect(dto.password).toBe(VALID_LOGIN.password);
    });

    it('deve validar email obrigatório', async () => {
      await expectFieldError(LoginDto, { password: 'password123' }, 'email');
    });

    it('deve validar formato de email', async () => {
      await expectFieldError(
        LoginDto,
        { email: 'email-invalido', password: 'password123' },
        'email'
      );
    });

    it('deve validar password obrigatório', async () => {
      await expectFieldError(LoginDto, { email: 'test@example.com' }, 'password');
    });

    it('deve validar tamanho mínimo da password', async () => {
      await expectFieldError(LoginDto, { ...VALID_LOGIN, password: '1234567' }, 'password');
    });

    it('deve passar na validação com dados corretos', async () => {
      await expectNoErrors(LoginDto, VALID_LOGIN);
    });
  });

  describe('RegisterDto', () => {
    it('deve criar RegisterDto com dados válidos', () => {
      const dto = plainToClass(RegisterDto, VALID_REGISTER);

      expect(dto.email).toBe(VALID_REGISTER.email);
      expect(dto.password).toBe(VALID_REGISTER.password);
      expect(dto.name).toBe(VALID_REGISTER.name);
      expect(dto.role).toBe(Role.ADMIN);
    });

    it('deve validar email obrigatório', async () => {
      await expectFieldError(
        RegisterDto,
        { password: 'password123', name: 'João Silva', role: Role.ADMIN },
        'email'
      );
    });

    it('deve validar formato de email', async () => {
      await expectFieldError(RegisterDto, { ...VALID_REGISTER, email: 'email-invalido' }, 'email');
    });

    it('deve validar password obrigatório', async () => {
      await expectFieldError(
        RegisterDto,
        { email: 'test@example.com', name: 'João Silva', role: Role.ADMIN },
        'password'
      );
    });

    it('deve validar tamanho mínimo da password', async () => {
      await expectFieldError(RegisterDto, { ...VALID_REGISTER, password: '1234567' }, 'password');
    });

    it('deve validar name obrigatório', async () => {
      await expectFieldError(RegisterDto, { ...VALID_LOGIN, role: Role.ADMIN }, 'name');
    });

    it('deve validar valores permitidos para role', async () => {
      await expectFieldError(
        RegisterDto,
        { ...VALID_REGISTER, role: 'invalid-role' as unknown as Role },
        'role'
      );
    });

    it.each([[Role.ADMIN], [Role.RECEPCIONISTA], [Role.MECANICO]])(
      'deve aceitar role "%s"',
      async (role) => {
        await expectNoErrors(RegisterDto, { ...VALID_REGISTER, role });
      }
    );

    it('deve aceitar RegisterDto sem role (opcional)', async () => {
      const data = { ...VALID_LOGIN, name: 'João Silva' };
      const dto = plainToClass(RegisterDto, data);
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
      expect(dto.role).toBeUndefined();
    });

    it('deve passar na validação com dados corretos', async () => {
      await expectNoErrors(RegisterDto, VALID_REGISTER);
    });
  });
});
