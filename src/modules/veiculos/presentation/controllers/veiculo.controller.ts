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
import { CreateVeiculoDto, UpdateVeiculoDto, ListQueryDto } from '../dto/veiculo.dto';
import { JwtAuthGuard } from '../../../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/auth/guards/roles.guard';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator';
import {
  CreateVeiculoUseCase,
  ListVeiculosUseCase,
  GetVeiculoUseCase,
  UpdateVeiculoUseCase,
  DeleteVeiculoUseCase,
} from '../../application/use-cases/veiculo.use-cases';

@Controller('veiculos')
@UseGuards(JwtAuthGuard)
export class VeiculoController {
  constructor(
    @Inject(CreateVeiculoUseCase) private readonly createUseCase: CreateVeiculoUseCase,
    @Inject(ListVeiculosUseCase) private readonly listUseCase: ListVeiculosUseCase,
    @Inject(GetVeiculoUseCase) private readonly getUseCase: GetVeiculoUseCase,
    @Inject(UpdateVeiculoUseCase) private readonly updateUseCase: UpdateVeiculoUseCase,
    @Inject(DeleteVeiculoUseCase) private readonly deleteUseCase: DeleteVeiculoUseCase
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateVeiculoDto) {
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
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVeiculoDto) {
    return this.updateUseCase.execute(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteUseCase.execute(id);
  }
}
