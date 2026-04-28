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
import {
  CreateOrdemServicoDto,
  UpdateOrdemServicoDto,
  ListQueryDto,
  GerarOrcamentoDto,
} from '../dto/ordem-servico.dto';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { Roles } from '../../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../../../auth/types/auth.types';
import {
  CreateOrdemServicoUseCase,
  ListOrdensServicoUseCase,
  GetOrdemServicoUseCase,
  UpdateOrdemServicoUseCase,
  DeleteOrdemServicoUseCase,
} from '../../application/use-cases/ordem-servico.use-cases';
import {
  GerarOrcamentoUseCase,
  AprovarOrcamentoUseCase,
  RejeitarOrcamentoUseCase,
} from '../../application/use-cases/orcamento.use-cases';

@ApiTags('Ordens Servico')
@ApiBearerAuth()
@Controller('ordens-servico')
@UseGuards(JwtAuthGuard)
export class OrdemServicoController {
  constructor(
    @Inject(CreateOrdemServicoUseCase)
    private readonly createUseCase: CreateOrdemServicoUseCase,
    @Inject(ListOrdensServicoUseCase)
    private readonly listUseCase: ListOrdensServicoUseCase,
    @Inject(GetOrdemServicoUseCase)
    private readonly getUseCase: GetOrdemServicoUseCase,
    @Inject(UpdateOrdemServicoUseCase)
    private readonly updateUseCase: UpdateOrdemServicoUseCase,
    @Inject(DeleteOrdemServicoUseCase)
    private readonly deleteUseCase: DeleteOrdemServicoUseCase,
    @Inject(GerarOrcamentoUseCase)
    private readonly gerarOrcamentoUseCase: GerarOrcamentoUseCase,
    @Inject(AprovarOrcamentoUseCase)
    private readonly aprovarOrcamentoUseCase: AprovarOrcamentoUseCase,
    @Inject(RejeitarOrcamentoUseCase)
    private readonly rejeitarOrcamentoUseCase: RejeitarOrcamentoUseCase
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Criar nova ordem de serviço',
    description: 'Cria uma nova ordem de serviço. Requer role de admin.',
  })
  @ApiBody({ type: CreateOrdemServicoDto })
  @ApiResponse({ status: 201, description: 'Ordem de serviço criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Validação falhou - dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role admin' })
  @ApiResponse({ status: 404, description: 'Veículo ou cliente não encontrado' })
  create(@Body() dto: CreateOrdemServicoDto) {
    return this.createUseCase.execute(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todas as ordens de serviço',
    description: 'Retorna lista paginada de ordens de serviço',
  })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'search', type: String, required: false, example: 'troca' })
  @ApiResponse({ status: 200, description: 'Lista de ordens de serviço retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  findAll(@Query() query: ListQueryDto, @CurrentUser() _user: AuthUser) {
    return this.listUseCase.execute(
      Number(query.page) || 1,
      Number(query.limit) || 10,
      query.search
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter ordem de serviço por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Ordem de serviço encontrada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() _user: AuthUser) {
    return this.getUseCase.execute(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Atualizar ordem de serviço',
    description: 'Atualiza status ou descrição. Requer role de admin.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateOrdemServicoDto })
  @ApiResponse({ status: 200, description: 'Ordem de serviço atualizada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role admin' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrdemServicoDto) {
    return this.updateUseCase.execute(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Deletar ordem de serviço' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Ordem de serviço deletada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role admin' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteUseCase.execute(id);
  }

  @Patch(':id/orcamento/gerar')
  @UseGuards(RolesGuard)
  @Roles('admin')
  gerarOrcamento(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GerarOrcamentoDto) {
    return this.gerarOrcamentoUseCase.execute(id, dto);
  }

  @Patch(':id/orcamento/aprovar')
  @UseGuards(RolesGuard)
  @Roles('admin')
  aprovarOrcamento(@Param('id', ParseUUIDPipe) id: string) {
    return this.aprovarOrcamentoUseCase.execute(id);
  }

  @Patch(':id/orcamento/rejeitar')
  @UseGuards(RolesGuard)
  @Roles('admin')
  rejeitarOrcamento(@Param('id', ParseUUIDPipe) id: string) {
    return this.rejeitarOrcamentoUseCase.execute(id);
  }
}
