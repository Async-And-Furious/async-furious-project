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
  NotificacaoAprovacaoOrcamentoDto,
} from '../dto/ordem-servico.dto';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { Roles } from '../../../../auth/decorators/roles.decorator';
import { Public } from '../../../../auth/decorators/public.decorator';
import { Role } from '../../../../auth/enums/role.enum';
import { CurrentUser } from '../../../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../../../auth/types/auth.types';
import {
  CriarOrdemServicoUseCase,
  AssumirOrdemServicoUseCase,
  AnalisarVeiculoUseCase,
  ListarServicosInsumosNaOsUseCase,
  AtualizarOrdemServicoUseCase,
  FinalizarExecucaoUseCase,
  AprovarServicoPrestadoUseCase,
  RegistrarEntregaVeiculoUseCase,
  ConsultarStatusOrdemServicoUseCase,
  ListarOrdensServicoUseCase,
  DetalharOrdemServicoUseCase,
  DeletarOrdemServicoUseCase,
} from '../../application/use-cases/ordem-servico.use-cases';
import {
  AprovarOrcamentoUseCase,
  RecusarOrcamentoUseCase,
} from '../../application/use-cases/orcamento.use-cases';
import { ConsultarTempoMedioExecucaoUseCase } from '../../application/use-cases/tempo-medio-execucao.use-case';

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
    @Inject(AtualizarOrdemServicoUseCase)
    private readonly atualizarOrdemServicoUseCase: AtualizarOrdemServicoUseCase,
    @Inject(AprovarOrcamentoUseCase)
    private readonly aprovarOrcamentoUseCase: AprovarOrcamentoUseCase,
    @Inject(RecusarOrcamentoUseCase)
    private readonly recusarOrcamentoUseCase: RecusarOrcamentoUseCase,
    @Inject(FinalizarExecucaoUseCase)
    private readonly finalizarExecucaoUseCase: FinalizarExecucaoUseCase,
    @Inject(AprovarServicoPrestadoUseCase)
    private readonly aprovarServicoPrestadoUseCase: AprovarServicoPrestadoUseCase,
    @Inject(RegistrarEntregaVeiculoUseCase)
    private readonly registrarEntregaVeiculoUseCase: RegistrarEntregaVeiculoUseCase,
    @Inject(ConsultarStatusOrdemServicoUseCase)
    private readonly consultarStatusUseCase: ConsultarStatusOrdemServicoUseCase,
    @Inject(ListarOrdensServicoUseCase)
    private readonly listarUseCase: ListarOrdensServicoUseCase,
    @Inject(DetalharOrdemServicoUseCase)
    private readonly detalharUseCase: DetalharOrdemServicoUseCase,
    @Inject(DeletarOrdemServicoUseCase)
    private readonly deletarUseCase: DeletarOrdemServicoUseCase,
    @Inject(ConsultarTempoMedioExecucaoUseCase)
    private readonly tempoMedioExecucaoUseCase: ConsultarTempoMedioExecucaoUseCase
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.RECEPCIONISTA)
  @ApiOperation({
    summary: 'Criar nova ordem de serviço',
    description: 'Cria uma nova ordem de serviço. Requer role de RECEPCIONISTA.',
  })
  @ApiBody({ type: CreateOrdemServicoDto })
  @ApiResponse({ status: 201, description: 'Ordem de serviço criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Validação falhou - dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role RECEPCIONISTA' })
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

  @Get('tempo-medio')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Tempo médio de execução das ordens de serviço (gestão administrativa)',
    description:
      'Retorna o tempo médio em minutos entre iniciada_em e finalizada_em de todas as OS entregues. Requer role ADMIN.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tempo médio retornado com sucesso',
    schema: {
      example: { tempoMedioMinutos: 87, totalOrdensConsideradas: 12 },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role ADMIN' })
  tempoMedioExecucao(): Promise<{ tempoMedioMinutos: number; totalOrdensConsideradas: number }> {
    return this.tempoMedioExecucaoUseCase.execute();
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
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  consultarStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.consultarStatusUseCase.execute(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Atualizar ordem de serviço antes da execução',
    description:
      'Atualiza status ou descrição somente enquanto a OS estiver em Recebida, Em Diagnóstico ou Aguardando Aprovação. Requer role de ADMIN.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateOrdemServicoDto })
  @ApiResponse({ status: 200, description: 'Ordem de serviço atualizada com sucesso' })
  @ApiResponse({
    status: 400,
    description: 'OS já entrou em execução ou o status informado não é permitido',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role ADMIN' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  atualizar(@Param('id', ParseUUIDPipe) id: string, @Body() _dto: UpdateOrdemServicoDto) {
    return this.atualizarOrdemServicoUseCase.execute(id, _dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deletar ordem de serviço' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Ordem de serviço deletada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role ADMIN' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  deletar(@Param('id', ParseUUIDPipe) id: string) {
    return this.deletarUseCase.execute(id);
  }

  @Patch(':id/assumir')
  @UseGuards(RolesGuard)
  @Roles(Role.MECANICO)
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
  @Roles(Role.MECANICO)
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
  @Roles(Role.MECANICO)
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
  @Public()
  @ApiOperation({
    summary: 'Aprovar orçamento (cliente) — inicia execução (AWAITING_APPROVAL → IN_PROGRESS)',
    description: 'Aprova o orçamento da ordem de serviço. Público.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Orçamento aprovado. OS → Em Execução' })
  @ApiResponse({ status: 400, description: 'Orçamento não está pendente ou sem valores' })
  @ApiResponse({ status: 404, description: 'OS ou orçamento não encontrado' })
  aprovarOrcamento(@Param('id', ParseUUIDPipe) id: string) {
    return this.aprovarOrcamentoUseCase.execute(id);
  }

  @Patch(':id/orcamento/recusar')
  @Public()
  @ApiOperation({
    summary:
      'Recusar orçamento (cliente) — encerra sem execução (AWAITING_APPROVAL → CLOSED_WITHOUT_EXECUTION)',
    description: 'Recusa o orçamento da ordem de serviço. Público.',
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
  @Roles(Role.MECANICO)
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
    summary: 'Cliente aprova o serviço prestado',
    description:
      'Confirma que o serviço finalizado está de acordo. A entrega é registrada separadamente pela recepção após o pagamento.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Serviço aprovado. OS permanece Finalizada' })
  @ApiResponse({ status: 400, description: 'OS não está Finalizada' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  aprovarServicoPrestado(@Param('id', ParseUUIDPipe) id: string) {
    return this.aprovarServicoPrestadoUseCase.execute(id);
  }

  @Post(':id/aprovar-servico')
  @Public()
  @ApiOperation({
    summary: 'Webhook: aprovação ou recusa de orçamento pelo cliente (AWAITING_APPROVAL → IN_PROGRESS | CLOSED_WITHOUT_EXECUTION)',
    description:
      'Endpoint público para receber notificações externas de aprovação ou recusa do orçamento. Aprovação move a OS para Em Execução; recusa encerra sem execução.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: NotificacaoAprovacaoOrcamentoDto })
  @ApiResponse({ status: 201, description: 'Decisão registrada. OS atualizada conforme decisão' })
  @ApiResponse({ status: 400, description: 'OS não está em Aguardando Aprovação ou orçamento inválido' })
  @ApiResponse({ status: 404, description: 'OS ou orçamento não encontrado' })
  notificarAprovacaoOrcamento(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NotificacaoAprovacaoOrcamentoDto
  ) {
    if (dto.decisao === 'APROVADO') {
      return this.aprovarOrcamentoUseCase.execute(id);
    }
    return this.recusarOrcamentoUseCase.execute(id);
  }

  @Patch(':id/registrar-entrega')
  @UseGuards(RolesGuard)
  @Roles(Role.RECEPCIONISTA)
  @ApiOperation({
    summary: 'Registrar entrega do veículo',
    description: 'Registra a entrega após o pagamento e move a OS para Entregue.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Entrega registrada. OS → Entregue' })
  @ApiResponse({ status: 400, description: 'OS não está Finalizada' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  registrarEntrega(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrarEntregaVeiculoUseCase.execute(id);
  }
}
