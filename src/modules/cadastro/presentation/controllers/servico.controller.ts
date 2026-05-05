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
import { CreateServicoDto, UpdateServicoDto, ListQueryDto } from '../dto/servico.dto';
import { Roles } from '../../../../auth/decorators/roles.decorator';
import { Role } from '../../../../auth/enums/role.enum';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { CurrentUser } from '../../../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../../../auth/types/auth.types';
import {
  CreateServicoUseCase,
  ListServicosUseCase,
  GetServicoUseCase,
  UpdateServicoUseCase,
  DeleteServicoUseCase,
} from '../../application/use-cases/servico.use-cases';

@Controller('servicos')
@ApiTags('Servicos')
@ApiBearerAuth()
export class ServicoController {
  constructor(
    @Inject(CreateServicoUseCase) private readonly createUseCase: CreateServicoUseCase,
    @Inject(ListServicosUseCase) private readonly listUseCase: ListServicosUseCase,
    @Inject(GetServicoUseCase) private readonly getUseCase: GetServicoUseCase,
    @Inject(UpdateServicoUseCase) private readonly updateUseCase: UpdateServicoUseCase,
    @Inject(DeleteServicoUseCase) private readonly deleteUseCase: DeleteServicoUseCase
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Criar novo servico',
    description: 'Cria um novo servico no sistema. Requer role de ADMIN.',
  })
  @ApiBody({
    type: CreateServicoDto,
    description: 'Dados do servico a ser criado',
    examples: {
      'Exemplo basico': {
        value: {
          nome: 'Lavagem completa',
          descricao: 'Lavagem interna e externa',
          preco: 120.5,
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Servico criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Validacao falhou - dados invalidos' })
  @ApiResponse({ status: 401, description: 'Nao autorizado - token invalido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role ADMIN' })
  create(@Body() dto: CreateServicoDto) {
    return this.createUseCase.execute(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todos os servicos',
    description: 'Retorna lista paginada de servicos',
  })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'search', type: String, required: false, example: 'Lavagem' })
  @ApiResponse({ status: 200, description: 'Lista de servicos retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Nao autorizado - token invalido ou expirado' })
  findAll(@Query() query: ListQueryDto, @CurrentUser() _user: AuthUser) {
    return this.listUseCase.execute(
      Number(query.page) || 1,
      Number(query.limit) || 10,
      query.search
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter servico por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servico encontrado com sucesso' })
  @ApiResponse({ status: 401, description: 'Nao autorizado - token invalido ou expirado' })
  @ApiResponse({ status: 404, description: 'Servico nao encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() _user: AuthUser) {
    return this.getUseCase.execute(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Atualizar servico' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateServicoDto })
  @ApiResponse({ status: 200, description: 'Servico atualizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Nao autorizado - token invalido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role ADMIN' })
  @ApiResponse({ status: 404, description: 'Servico nao encontrado' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServicoDto) {
    return this.updateUseCase.execute(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deletar servico' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Servico deletado com sucesso' })
  @ApiResponse({ status: 401, description: 'Nao autorizado - token invalido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role ADMIN' })
  @ApiResponse({ status: 404, description: 'Servico nao encontrado' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteUseCase.execute(id);
  }
}
