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
  CreatePecaInsumoDto,
  UpdatePecaInsumoDto,
  UpdateEstoquePecaInsumoDto,
  ListQueryDto,
  SolicitarReposicaoDto,
} from '../dto/peca-insumo.dto';
import { Roles } from '../../../../auth/decorators/roles.decorator';
import { Role } from '../../../../auth/enums/role.enum';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { CurrentUser } from '../../../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../../../auth/types/auth.types';
import {
  CreatePecaInsumoUseCase,
  ListPecasInsumoUseCase,
  GetPecaInsumoUseCase,
  UpdatePecaInsumoUseCase,
  UpdateEstoquePecaInsumoUseCase,
  DeletePecaInsumoUseCase,
} from '../../application/use-cases/peca-insumo.use-cases';
import {
  SolicitarPecasAoFornecedorUseCase,
  ReceberPecasDoFornecedorUseCase,
} from '../../application/use-cases/fornecedor.use-cases';

@ApiTags('Pecas Insumos')
@ApiBearerAuth()
@Controller('pecas')
export class PecaInsumoController {
  constructor(
    @Inject(CreatePecaInsumoUseCase) private readonly createUseCase: CreatePecaInsumoUseCase,
    @Inject(ListPecasInsumoUseCase) private readonly listUseCase: ListPecasInsumoUseCase,
    @Inject(GetPecaInsumoUseCase) private readonly getUseCase: GetPecaInsumoUseCase,
    @Inject(UpdatePecaInsumoUseCase) private readonly updateUseCase: UpdatePecaInsumoUseCase,
    @Inject(UpdateEstoquePecaInsumoUseCase)
    private readonly updateEstoqueUseCase: UpdateEstoquePecaInsumoUseCase,
    @Inject(DeletePecaInsumoUseCase) private readonly deleteUseCase: DeletePecaInsumoUseCase,
    @Inject(SolicitarPecasAoFornecedorUseCase)
    private readonly solicitarPecasUseCase: SolicitarPecasAoFornecedorUseCase,
    @Inject(ReceberPecasDoFornecedorUseCase)
    private readonly receberPecasUseCase: ReceberPecasDoFornecedorUseCase
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Criar nova peça/insumo',
    description: 'Cria uma nova peça ou insumo no sistema. Requer role de ADMIN.',
  })
  @ApiBody({ type: CreatePecaInsumoDto })
  @ApiResponse({ status: 201, description: 'Peça/insumo criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Validação falhou - dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role ADMIN' })
  create(@Body() dto: CreatePecaInsumoDto) {
    return this.createUseCase.execute(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todas as peças/insumos',
    description: 'Retorna lista paginada de peças e insumos',
  })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 10 })
  @ApiQuery({ name: 'search', type: String, required: false, example: 'Filtro' })
  @ApiResponse({ status: 200, description: 'Lista de peças/insumos retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  findAll(@Query() query: ListQueryDto, @CurrentUser() _user: AuthUser) {
    return this.listUseCase.execute(
      Number(query.page) || 1,
      Number(query.limit) || 10,
      query.search
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter peça/insumo por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Peça/insumo encontrado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 404, description: 'Peça/insumo não encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() _user: AuthUser) {
    return this.getUseCase.execute(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Atualizar peça/insumo' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdatePecaInsumoDto })
  @ApiResponse({ status: 200, description: 'Peça/insumo atualizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role ADMIN' })
  @ApiResponse({ status: 404, description: 'Peça/insumo não encontrado' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePecaInsumoDto) {
    return this.updateUseCase.execute(id, dto);
  }

  @Patch(':id/estoque')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Atualizar estoque de peça/insumo',
    description: 'Atualiza apenas a quantidade em estoque',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateEstoquePecaInsumoDto })
  @ApiResponse({ status: 200, description: 'Estoque atualizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role ADMIN' })
  @ApiResponse({ status: 404, description: 'Peça/insumo não encontrado' })
  updateEstoque(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEstoquePecaInsumoDto) {
    return this.updateEstoqueUseCase.execute(id, dto.quantidade);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deletar peça/insumo' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Peça/insumo deletado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado - token inválido ou expirado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role ADMIN' })
  @ApiResponse({ status: 404, description: 'Peça/insumo não encontrado' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteUseCase.execute(id);
  }

  @Post('fornecedor/solicitar')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Solicitar peças a fornecedor (P-22)' })
  @ApiBody({ type: SolicitarReposicaoDto })
  @ApiResponse({ status: 201, description: 'Pedido enviado ao fornecedor' })
  @ApiResponse({ status: 400, description: 'Lista de peças vazia' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role admin' })
  @ApiResponse({ status: 404, description: 'Peça não encontrada no catálogo' })
  async solicitarReposicao(@Body() dto: SolicitarReposicaoDto) {
    await this.solicitarPecasUseCase.execute({
      fornecedorId: dto.fornecedorId,
      pecas: dto.pecas.map((p) => ({
        pecaId: p.pecaId,
        quantidadeSolicitada: p.quantidadeSolicitada,
      })),
    });
  }

  @Patch('fornecedor/pedidos/:pedidoId/receber')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Confirmar recebimento de peças do fornecedor (P-23)' })
  @ApiParam({ name: 'pedidoId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Estoque atualizado após recebimento' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado - requer role admin' })
  @ApiResponse({ status: 404, description: 'Pedido não encontrado' })
  @ApiResponse({ status: 409, description: 'Pedido já foi recebido' })
  async receberPecas(@Param('pedidoId', ParseUUIDPipe) pedidoId: string) {
    await this.receberPecasUseCase.execute({ pedidoId });
  }
}
