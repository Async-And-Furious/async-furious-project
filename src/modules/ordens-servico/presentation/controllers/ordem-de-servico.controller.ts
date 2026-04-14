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
  CreateOrdemDeServicoDto,
  UpdateOrdemDeServicoDto,
  ListQueryDto,
} from '../dto/ordem-de-servico.dto';
import { JwtAuthGuard } from '../../../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/auth/guards/roles.guard';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator';
import {
  CreateOrdemDeServicoUseCase,
  ListOrdensDeServicoUseCase,
  GetOrdemDeServicoUseCase,
  UpdateOrdemDeServicoUseCase,
  DeleteOrdemDeServicoUseCase,
} from '../../application/use-cases/ordem-de-servico.use-cases';

@Controller('ordens-servico')
@UseGuards(JwtAuthGuard)
export class OrdemDeServicoController {
  constructor(
    @Inject(CreateOrdemDeServicoUseCase)
    private readonly createUseCase: CreateOrdemDeServicoUseCase,
    @Inject(ListOrdensDeServicoUseCase) private readonly listUseCase: ListOrdensDeServicoUseCase,
    @Inject(GetOrdemDeServicoUseCase) private readonly getUseCase: GetOrdemDeServicoUseCase,
    @Inject(UpdateOrdemDeServicoUseCase)
    private readonly updateUseCase: UpdateOrdemDeServicoUseCase,
    @Inject(DeleteOrdemDeServicoUseCase) private readonly deleteUseCase: DeleteOrdemDeServicoUseCase
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateOrdemDeServicoDto) {
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
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrdemDeServicoDto) {
    return this.updateUseCase.execute(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteUseCase.execute(id);
  }
}
