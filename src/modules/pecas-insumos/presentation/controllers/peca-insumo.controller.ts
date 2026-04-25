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
  CreatePecaInsumoDto,
  UpdatePecaInsumoDto,
  UpdateEstoquePecaInsumoDto,
  ListQueryDto,
} from '../dto/peca-insumo.dto';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { Roles } from '../../../../auth/decorators/roles.decorator';
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

@Controller('pecas')
@UseGuards(JwtAuthGuard)
export class PecaInsumoController {
  constructor(
    @Inject(CreatePecaInsumoUseCase) private readonly createUseCase: CreatePecaInsumoUseCase,
    @Inject(ListPecasInsumoUseCase) private readonly listUseCase: ListPecasInsumoUseCase,
    @Inject(GetPecaInsumoUseCase) private readonly getUseCase: GetPecaInsumoUseCase,
    @Inject(UpdatePecaInsumoUseCase) private readonly updateUseCase: UpdatePecaInsumoUseCase,
    @Inject(UpdateEstoquePecaInsumoUseCase)
    private readonly updateEstoqueUseCase: UpdateEstoquePecaInsumoUseCase,
    @Inject(DeletePecaInsumoUseCase) private readonly deleteUseCase: DeletePecaInsumoUseCase
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreatePecaInsumoDto) {
    return this.createUseCase.execute(dto);
  }

  @Get()
  findAll(@Query() query: ListQueryDto, @CurrentUser() _user: AuthUser) {
    return this.listUseCase.execute(
      Number(query.page) || 1,
      Number(query.limit) || 10,
      query.search
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() _user: AuthUser) {
    return this.getUseCase.execute(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePecaInsumoDto) {
    return this.updateUseCase.execute(id, dto);
  }

  @Patch(':id/estoque')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateEstoque(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEstoquePecaInsumoDto) {
    return this.updateEstoqueUseCase.execute(id, dto.quantidade);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteUseCase.execute(id);
  }
}
