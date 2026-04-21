import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateClienteDto, UpdateClienteDto, ListQueryDto } from '../dto/cliente.dto';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { Roles } from '../../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../../../auth/types/auth.types';
import {
  CreateClienteUseCase,
  ListClientesUseCase,
  GetClienteUseCase,
  UpdateClienteUseCase,
  DeleteClienteUseCase,
} from '../../application/use-cases/cliente.use-cases';

@Controller('clientes')
@ApiTags('Clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ClienteController {
  constructor(
    @Inject(CreateClienteUseCase) private readonly createUseCase: CreateClienteUseCase,
    @Inject(ListClientesUseCase) private readonly listUseCase: ListClientesUseCase,
    @Inject(GetClienteUseCase) private readonly getUseCase: GetClienteUseCase,
    @Inject(UpdateClienteUseCase) private readonly updateUseCase: UpdateClienteUseCase,
    @Inject(DeleteClienteUseCase) private readonly deleteUseCase: DeleteClienteUseCase
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Criar novo cliente',
    description: 'Cria um novo cliente no sistema. Requer role de admin.',
  })
  @ApiBody({
    type: CreateClienteDto,
    description: 'Dados do cliente a ser criado',
    examples: {
      'Exemplo com CPF': {
        value: {
          name: 'João Silva',
          email: 'joao@example.com',
          phone: '11999999999',
          tax_id: '12345678901',
          tax_id_type: 'CPF',
        },
      },
      'Exemplo com CNPJ': {
        value: {
          name: 'Empresa XYZ',
          email: 'contato@empresa.com',
          phone: '1133333333',
          tax_id: '12345678000190',
          tax_id_type: 'CNPJ',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Cliente criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Validação falhou - dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role admin' })
  create(@Body() dto: CreateClienteDto) {
    return this.createUseCase.execute(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todos os clientes',
    description: 'Retorna lista paginada de clientes',
  })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'search', type: String, required: false, example: 'João' })
  @ApiResponse({ status: 200, description: 'Lista de clientes retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  findAll(@Query() query: ListQueryDto, @CurrentUser() _user: AuthUser) {
    return this.listUseCase.execute(
      Number(query.page) || 1,
      Number(query.limit) || 10,
      query.search
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter cliente por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cliente encontrado com sucesso' })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() _user: AuthUser) {
    return this.getUseCase.execute(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Atualizar cliente' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateClienteDto })
  @ApiResponse({ status: 200, description: 'Cliente atualizado com sucesso' })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClienteDto) {
    return this.updateUseCase.execute(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Deletar cliente' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cliente deletado com sucesso' })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteUseCase.execute(id);
  }
}
