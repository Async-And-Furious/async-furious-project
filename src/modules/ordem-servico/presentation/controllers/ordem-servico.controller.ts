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
import { CreateOrdemServicoDto, ListQueryDto, GerarOrcamentoDto } from '../dto/ordem-servico.dto';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { Roles } from '../../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../../../auth/types/auth.types';
import {
  CriarOrdemServicoUseCase,
  AssumirOrdemServicoUseCase,
  AnalisarVeiculoUseCase,
  ListarServicosInsumosNaOsUseCase,
  FinalizarExecucaoUseCase,
  AprovarServicoPrestadoUseCase,
  ConsultarStatusOrdemServicoUseCase,
  ListarOrdensServicoUseCase,
  DetalharOrdemServicoUseCase,
  DeletarOrdemServicoUseCase,
} from '../../application/use-cases/ordem-servico.use-cases';
import {
  AprovarOrcamentoUseCase,
  RecusarOrcamentoUseCase,
} from '../../application/use-cases/orcamento.use-cases';

@ApiTags('Ordens Servico')
@ApiBearerAuth()
@Controller('ordens-servico')
@UseGuards(JwtAuthGuard)
export class OrdemServicoController {
  constructor(
    @Inject(CriarOrdemServicoUseCase)
    private readonly criarUseCase: CriarOrdemServicoUseCase,
    @Inject(AssumirOrdemServicoUseCase)
    private readonly assumirUseCase: AssumirOrdemServicoUseCase,
    @Inject(AnalisarVeiculoUseCase)
    private readonly analisarVeiculoUseCase: AnalisarVeiculoUseCase,
    @Inject(ListarServicosInsumosNaOsUseCase)
    private readonly listarServicosInsumosUseCase: ListarServicosInsumosNaOsUseCase,
    @Inject(AprovarOrcamentoUseCase)
    private readonly aprovarOrcamentoUseCase: AprovarOrcamentoUseCase,
    @Inject(RecusarOrcamentoUseCase)
    private readonly recusarOrcamentoUseCase: RecusarOrcamentoUseCase,
    @Inject(FinalizarExecucaoUseCase)
    private readonly finalizarExecucaoUseCase: FinalizarExecucaoUseCase,
    @Inject(AprovarServicoPrestadoUseCase)
    private readonly aprovarServicoPrestadoUseCase: AprovarServicoPrestadoUseCase,
    @Inject(ConsultarStatusOrdemServicoUseCase)
    private readonly consultarStatusUseCase: ConsultarStatusOrdemServicoUseCase,
    @Inject(ListarOrdensServicoUseCase)
    private readonly listarUseCase: ListarOrdensServicoUseCase,
    @Inject(DetalharOrdemServicoUseCase)
    private readonly detalharUseCase: DetalharOrdemServicoUseCase,
    @Inject(DeletarOrdemServicoUseCase)
    private readonly deletarUseCase: DeletarOrdemServicoUseCase
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Criar nova ordem de serviço' })
  @ApiBody({ type: CreateOrdemServicoDto })
  @ApiResponse({ status: 201, description: 'Ordem de serviço criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado — requer role admin' })
  @ApiResponse({ status: 404, description: 'Veículo ou cliente não encontrado' })
  criar(@Body() dto: CreateOrdemServicoDto) {
    return this.criarUseCase.execute(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as ordens de serviço (paginado)' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'search', type: String, required: false, example: 'troca' })
  @ApiResponse({ status: 200, description: 'Lista retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  listar(@Query() query: ListQueryDto, @CurrentUser() _user: AuthUser) {
    return this.listarUseCase.execute(
      Number(query.page) || 1,
      Number(query.limit) || 10,
      query.search
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhar ordem de serviço' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Ordem de serviço encontrada' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  detalhar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() _user: AuthUser) {
    return this.detalharUseCase.execute(id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Consultar status da OS (para o cliente)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Status retornado com sucesso' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  consultarStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.consultarStatusUseCase.execute(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Deletar ordem de serviço' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Ordem de serviço deletada' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado — requer role admin' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  deletar(@Param('id', ParseUUIDPipe) id: string) {
    return this.deletarUseCase.execute(id);
  }

  @Patch(':id/assumir')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Mecânico assume a OS — inicia diagnóstico (RECEIVED → UNDER_DIAGNOSIS)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'OS assumida. Status → Em Diagnóstico' })
  @ApiResponse({ status: 400, description: 'OS não está no status Recebida' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  assumir(@Param('id', ParseUUIDPipe) id: string) {
    return this.assumirUseCase.execute(id);
  }

  @Patch(':id/analisar')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Registrar análise do veículo (UNDER_DIAGNOSIS)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Análise registrada' })
  @ApiResponse({ status: 400, description: 'OS não está Em Diagnóstico' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  analisarVeiculo(@Param('id', ParseUUIDPipe) id: string) {
    return this.analisarVeiculoUseCase.execute(id);
  }

  @Patch(':id/servicos-insumos')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Listar serviços e insumos — gera orçamento (UNDER_DIAGNOSIS → AWAITING_APPROVAL)',
    description:
      'Registra valores de serviços e peças. Gera orçamento e atualiza OS para Aguardando Aprovação.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: GerarOrcamentoDto })
  @ApiResponse({ status: 200, description: 'Orçamento gerado. OS → Aguardando Aprovação' })
  @ApiResponse({
    status: 400,
    description: 'OS não está em status válido ou orçamento já aprovado',
  })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  listarServicosInsumos(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GerarOrcamentoDto) {
    return this.listarServicosInsumosUseCase.execute(id, dto);
  }

  @Patch(':id/orcamento/aprovar')
  @ApiOperation({
    summary: 'Aprovar orçamento (cliente) — inicia execução (AWAITING_APPROVAL → IN_PROGRESS)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Orçamento aprovado. OS → Em Execução' })
  @ApiResponse({ status: 400, description: 'Orçamento não está pendente ou sem valores' })
  @ApiResponse({ status: 404, description: 'OS ou orçamento não encontrado' })
  aprovarOrcamento(@Param('id', ParseUUIDPipe) id: string) {
    return this.aprovarOrcamentoUseCase.execute(id);
  }

  @Patch(':id/orcamento/recusar')
  @ApiOperation({
    summary:
      'Recusar orçamento (cliente) — encerra sem execução (AWAITING_APPROVAL → CLOSED_WITHOUT_EXECUTION)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Orçamento recusado. OS → Encerrada Sem Execução' })
  @ApiResponse({ status: 400, description: 'Orçamento não está pendente' })
  @ApiResponse({ status: 404, description: 'OS ou orçamento não encontrado' })
  recusarOrcamento(@Param('id', ParseUUIDPipe) id: string) {
    return this.recusarOrcamentoUseCase.execute(id);
  }

  @Patch(':id/finalizar-execucao')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Mecânico finaliza execução do serviço (IN_PROGRESS → FINISHED)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Execução finalizada. OS → Finalizada' })
  @ApiResponse({ status: 400, description: 'OS não está Em Execução' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  finalizarExecucao(@Param('id', ParseUUIDPipe) id: string) {
    return this.finalizarExecucaoUseCase.execute(id);
  }

  @Patch(':id/aprovar-servico')
  @ApiOperation({
    summary: 'Cliente aprova o serviço prestado — entrega o veículo (FINISHED → DELIVERED)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Serviço aprovado. OS → Entregue' })
  @ApiResponse({ status: 400, description: 'OS não está Finalizada' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  aprovarServicoPrestado(@Param('id', ParseUUIDPipe) id: string) {
    return this.aprovarServicoPrestadoUseCase.execute(id);
  }
}
