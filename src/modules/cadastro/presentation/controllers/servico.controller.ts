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
import { CreateServicoDto, UpdateServicoDto, ListQueryDto } from '../dto/servico.dto';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { Roles } from '../../../../auth/decorators/roles.decorator';
import {
  CreateServicoUseCase,
  ListServicosUseCase,
  GetServicoUseCase,
  UpdateServicoUseCase,
  DeleteServicoUseCase,
} from '../../application/use-cases/servico.use-cases';

@Controller('servicos')
@UseGuards(JwtAuthGuard)
export class ServicoController {
  constructor(
    @Inject(CreateServicoUseCase) private readonly createUseCase: CreateServicoUseCase,
    @Inject(ListServicosUseCase) private readonly listUseCase: ListServicosUseCase,
    @Inject(GetServicoUseCase) private readonly getUseCase: GetServicoUseCase,
    @Inject(UpdateServicoUseCase) private readonly updateUseCase: UpdateServicoUseCase,
    @Inject(DeleteServicoUseCase) private readonly deleteUseCase: DeleteServicoUseCase
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateServicoDto) {
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
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServicoDto) {
    return this.updateUseCase.execute(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteUseCase.execute(id);
  }
}
