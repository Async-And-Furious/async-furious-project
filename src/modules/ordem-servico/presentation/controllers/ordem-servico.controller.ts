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
    private readonly deleteUseCase: DeleteOrdemServicoUseCase
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
}
