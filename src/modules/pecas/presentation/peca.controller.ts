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
import { CreatePecaDto, UpdatePecaDto, UpdateEstoqueDto, ListQueryDto } from './dto/peca.dto';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/auth/guards/roles.guard';
import { Roles } from '../../../shared/auth/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../../shared/auth/types/auth.types';
import {
  CreatePecaUseCase,
  ListPecasUseCase,
  GetPecaUseCase,
  UpdatePecaUseCase,
  UpdateEstoquePecaUseCase,
  DeletePecaUseCase,
} from '../application/use-cases/peca.use-cases';

@Controller('pecas')
@UseGuards(JwtAuthGuard)
export class PecaController {
  constructor(
    @Inject(CreatePecaUseCase) private readonly createUseCase: CreatePecaUseCase,
    @Inject(ListPecasUseCase) private readonly listUseCase: ListPecasUseCase,
    @Inject(GetPecaUseCase) private readonly getUseCase: GetPecaUseCase,
    @Inject(UpdatePecaUseCase) private readonly updateUseCase: UpdatePecaUseCase,
    @Inject(UpdateEstoquePecaUseCase) private readonly updateEstoqueUseCase: UpdateEstoquePecaUseCase,
    @Inject(DeletePecaUseCase) private readonly deleteUseCase: DeletePecaUseCase,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreatePecaDto) {
    return this.createUseCase.execute(dto);
  }

  @Get()
  findAll(@Query() query: ListQueryDto, @CurrentUser() _user: AuthUser) {
    return this.listUseCase.execute(
      Number(query.page) || 1,
      Number(query.limit) || 10,
      query.search,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() _user: AuthUser) {
    return this.getUseCase.execute(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePecaDto) {
    return this.updateUseCase.execute(id, dto);
  }

  @Patch(':id/estoque')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateEstoque(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEstoqueDto) {
    return this.updateEstoqueUseCase.execute(id, dto.quantidade);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteUseCase.execute(id);
  }
}
