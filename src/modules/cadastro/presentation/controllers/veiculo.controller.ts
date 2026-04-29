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
import { CreateVeiculoDto, UpdateVeiculoDto, ListQueryDto } from '../dto/veiculo.dto';
import { Roles } from '../../../../auth/decorators/roles.decorator';
import { Role } from '../../../../auth/enums/role.enum';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { CurrentUser } from '../../../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../../../auth/types/auth.types';
import {
  CreateVeiculoUseCase,
  ListVeiculosUseCase,
  GetVeiculoUseCase,
  UpdateVeiculoUseCase,
  DeleteVeiculoUseCase,
} from '../../application/use-cases/veiculo.use-cases';

@ApiTags('Veiculos')
@ApiBearerAuth()
@Controller('veiculos')
export class VeiculoController {
  constructor(
    @Inject(CreateVeiculoUseCase) private readonly createUseCase: CreateVeiculoUseCase,
    @Inject(ListVeiculosUseCase) private readonly listUseCase: ListVeiculosUseCase,
    @Inject(GetVeiculoUseCase) private readonly getUseCase: GetVeiculoUseCase,
    @Inject(UpdateVeiculoUseCase) private readonly updateUseCase: UpdateVeiculoUseCase,
    @Inject(DeleteVeiculoUseCase) private readonly deleteUseCase: DeleteVeiculoUseCase
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.RECEPCIONISTA)
  @ApiOperation({
    summary: 'Criar novo veículo',
    description: 'Cria um novo veículo no sistema. Requer role de RECEPCIONISTA.',
  })
  @ApiBody({ type: CreateVeiculoDto })
  @ApiResponse({ status: 201, description: 'Veículo criado com sucesso' })
  @ApiResponse({
    status: 400,
    description: 'Validação falhou - dados inválidos ou placa duplicada',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role RECEPCIONISTA' })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
  create(@Body() dto: CreateVeiculoDto) {
    return this.createUseCase.execute(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todos os veículos',
    description: 'Retorna lista paginada de veículos',
  })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'search', type: String, required: false, example: 'Toyota' })
  @ApiResponse({ status: 200, description: 'Lista de veículos retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  findAll(@Query() query: ListQueryDto, @CurrentUser() _user: AuthUser) {
    return this.listUseCase.execute(
      Number(query.page) || 1,
      Number(query.limit) || 10,
      query.search
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter veículo por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Veículo encontrado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 404, description: 'Veículo não encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() _user: AuthUser) {
    return this.getUseCase.execute(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.RECEPCIONISTA)
  @ApiOperation({ summary: 'Atualizar veículo' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateVeiculoDto })
  @ApiResponse({ status: 200, description: 'Veículo atualizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role RECEPCIONISTA' })
  @ApiResponse({ status: 404, description: 'Veículo não encontrado' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVeiculoDto) {
    return this.updateUseCase.execute(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deletar veículo' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Veículo deletado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role ADMIN' })
  @ApiResponse({ status: 404, description: 'Veículo não encontrado' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteUseCase.execute(id);
  }
}
