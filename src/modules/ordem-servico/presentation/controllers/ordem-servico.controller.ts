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
  CreateOrdemServicoDto,
  UpdateOrdemServicoDto,
  ListQueryDto,
  GerarOrcamentoDto,
} from '../dto/ordem-servico.dto';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { Roles } from '../../../../auth/decorators/roles.decorator';
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
  create(@Body() dto: CreateOrdemServicoDto) {
    return this.createUseCase.execute(dto);
  }

  @Get()
  findAll(@Query() query: ListQueryDto) {
    return this.listUseCase.execute(
      Number(query.page) || 1,
      Number(query.limit) || 10,
      query.search
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.getUseCase.execute(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrdemServicoDto) {
    return this.updateUseCase.execute(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
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
