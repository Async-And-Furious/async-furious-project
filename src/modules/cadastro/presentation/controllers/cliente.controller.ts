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
import { ClienteResponseDto, ClienteListResponseDto } from '../dto/cliente.response.dto';
import { Roles } from '../../../../auth/decorators/roles.decorator';
import { Role } from '../../../../auth/enums/role.enum';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { CurrentUser } from '../../../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../../../auth/types/auth.types';
import {
  CreateClienteUseCase,
  ListClientesUseCase,
  GetClienteUseCase,
  UpdateClienteUseCase,
  DeleteClienteUseCase,
} from '../../application/use-cases';

@Controller('clientes')
@ApiTags('Clientes')
@ApiBearerAuth()
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
  @Roles(Role.RECEPCIONISTA)
  @ApiOperation({
    summary: 'Criar novo cliente',
    description: 'Cria um novo cliente no sistema. Requer role de RECEPCIONISTA.',
  })
  @ApiBody({
    type: CreateClienteDto,
    description: 'Dados do cliente a ser criado',
    examples: {
      'Exemplo com CPF': {
        value: {
          nome: 'João Silva',
          email: 'joao@example.com',
          telefone: '11999999999',
          documento: '12345678901',
          tipoDocumento: 'CPF',
        },
      },
      'Exemplo com CNPJ': {
        value: {
          nome: 'Empresa XYZ',
          email: 'contato@empresa.com',
          telefone: '1133333333',
          documento: '12345678000190',
          tipoDocumento: 'CNPJ',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Cliente criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Validação falhou - dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role RECEPCIONISTA' })
  async create(@Body() dto: CreateClienteDto): Promise<ClienteResponseDto> {
    const cliente = await this.createUseCase.execute(dto);
    return ClienteResponseDto.fromDomain(cliente);
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
  async findAll(
    @Query() query: ListQueryDto,
    @CurrentUser() _user: AuthUser
  ): Promise<ClienteListResponseDto> {
    const result = await this.listUseCase.execute(
      Number(query.page) || 1,
      Number(query.limit) || 10,
      query.search
    );
    return ClienteListResponseDto.fromDomain(result.data, result.pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter cliente por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cliente encontrado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() _user: AuthUser
  ): Promise<ClienteResponseDto> {
    const cliente = await this.getUseCase.execute(id);
    return ClienteResponseDto.fromDomain(cliente);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.RECEPCIONISTA)
  @ApiOperation({ summary: 'Atualizar cliente' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateClienteDto })
  @ApiResponse({ status: 200, description: 'Cliente atualizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role RECEPCIONISTA' })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClienteDto
  ): Promise<ClienteResponseDto> {
    const cliente = await this.updateUseCase.execute(id, dto);
    return ClienteResponseDto.fromDomain(cliente);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deletar cliente' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cliente deletado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role ADMIN' })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ClienteResponseDto> {
    const cliente = await this.deleteUseCase.execute(id);
    return ClienteResponseDto.fromDomain(cliente);
  }
}
