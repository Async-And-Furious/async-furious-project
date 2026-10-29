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
  ApiSecurity,
} from '@nestjs/swagger';
import {
  CreateOrdemServicoDto,
  UpdateOrdemServicoDto,
  FilaQueryDto,
  GerarOrcamentoDto,
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
    description:
      'Cria uma nova ordem de serviço recebendo cliente, veículo, serviços e peças. Calcula o orçamento e cria OS com status RECEIVED.',
  })
  @ApiBody({ type: CreateOrdemServicoDto })
  @ApiResponse({ status: 201, description: 'Ordem de serviço criada com sucesso, retorna o ID.' })
  @ApiResponse({ status: 400, description: 'Validação falhou - dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role RECEPCIONISTA' })
  async criar(@Body() dto: CreateOrdemServicoDto) {
    const os = await this.criarUseCase.execute(dto);
    return { id: os.id };
  }

  @Get()
  @ApiOperation({
    summary: 'Fila de ordens de serviço ativas por prioridade (read model)',
    description:
      'Servida pelo read model (DocumentDB). Exclui FINISHED, DELIVERED e CLOSED_WITHOUT_EXECUTION e ordena por prioridade de status (IN_PROGRESS → AWAITING_APPROVAL → UNDER_DIAGNOSIS → RECEIVED → AWAITING_PARTS); dentro do mesmo status, as mais antigas primeiro. Paginação por cursor: envie pagination.nextCursor no parâmetro cursor para a próxima página.',
  })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'cursor', type: String, required: false })
  @ApiResponse({
    status: 200,
    description: 'Página da fila de OS ativas',
    schema: {
      example: {
        data: [
          {
            id: 'uuid',
            clienteId: 'uuid',
            veiculoId: 'uuid',
            status: 'IN_PROGRESS',
            descricao: 'Troca de óleo',
            iniciada_em: '2024-01-01T01:00:00.000Z',
            finalizada_em: null,
            entregue_em: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T01:00:00.000Z',
            cliente: { id: 'uuid', nome: 'João Silva', documento: '12345678909' },
            veiculo: { id: 'uuid', placa: 'ABC1D23', marca: 'Honda', modelo: 'Fit' },
          },
        ],
        pagination: { limit: 10, nextCursor: 'eyJwIjoxLCJjIjoi...' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cursor ou limite inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  listar(@Query() query: FilaQueryDto) {
    return this.listarUseCase.execute(query.limit ?? 10, query.cursor);
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
  @ApiOperation({
    summary: 'Detalhar ordem de serviço (read model)',
    description:
      'Servida pelo read model: status, marcos, cliente e veículo embutidos. Não inclui orçamento, itens nem histórico.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Ordem de serviço encontrada' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  detalhar(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() _user: AuthUser) {
    return this.detalharUseCase.execute(id);
  }

  @Get(':id/status')
  @Public()
  @ApiSecurity({})
  @ApiOperation({
    summary: 'Consultar status da OS (rota pública, sem token)',
    description:
      'Única rota pública do OS Service, servida pelo read model. Resposta mínima: id, status e marcos de tempo da OS, sem dados do cliente.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Status retornado com sucesso' })
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
    description:
      'Deprecated: migra para PATCH /api/v1/execucoes/{id}/iniciar-diagnostico no serviço de Execução e Produção (#334). Lá o {id} é o da Execução (listar em GET /api/v1/execucoes), não o da OS.',
    deprecated: true,
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
  @ApiOperation({
    summary: 'Registrar análise do veículo (UNDER_DIAGNOSIS)',
    description:
      'Deprecated: sem rota equivalente; o registro da análise é absorvido por PATCH /api/v1/execucoes/{id}/iniciar-diagnostico no serviço de Execução e Produção (#334), onde o {id} é o da Execução, não o da OS.',
    deprecated: true,
  })
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
  @ApiResponse({
    status: 200,
    description:
      'Orçamento aprovado. OS → Em Execução. Resposta inclui linkPagamento (Checkout Pro)',
  })
  @ApiResponse({ status: 400, description: 'Orçamento não está pendente ou sem valores' })
  @ApiResponse({ status: 404, description: 'OS ou orçamento não encontrado' })
  @ApiResponse({
    status: 502,
    description: 'Falha ao gerar o link no Mercado Pago. Orçamento continua pendente',
  })
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
    description:
      'Deprecated: migra para PATCH /api/v1/execucoes/{id}/concluir no serviço de Execução e Produção (#334). Lá o {id} é o da Execução, não o da OS.',
    deprecated: true,
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
    summary: 'Aprovar o serviço prestado (requer JWT)',
    description:
      'Confirma que o serviço finalizado está de acordo. A OS permanece Finalizada; a entrega é registrada separadamente pela recepção.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Serviço aprovado. OS permanece Finalizada' })
  @ApiResponse({ status: 400, description: 'OS não está Finalizada' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  aprovarServicoPrestado(@Param('id', ParseUUIDPipe) id: string) {
    return this.aprovarServicoPrestadoUseCase.execute(id);
  }

  @Patch(':id/registrar-entrega')
  @UseGuards(RolesGuard)
  @Roles(Role.RECEPCIONISTA)
  @ApiOperation({
    summary: 'Registrar entrega do veículo',
    description: 'Registra a entrega do veículo e move a OS para Entregue.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Entrega registrada. OS → Entregue' })
  @ApiResponse({ status: 400, description: 'OS não está Finalizada' })
  @ApiResponse({ status: 404, description: 'Ordem de serviço não encontrada' })
  registrarEntrega(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrarEntregaVeiculoUseCase.execute(id);
  }
}
