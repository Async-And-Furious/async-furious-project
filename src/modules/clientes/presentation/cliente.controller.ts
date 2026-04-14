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
import { CreateClienteDto, UpdateClienteDto, ListQueryDto } from './dto/cliente.dto';
import { JwtAuthGuard } from '../../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/auth/guards/roles.guard';
import { Roles } from '../../../shared/auth/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/auth/decorators/current-user.decorator';
import type { AuthUser } from '../../../shared/auth/types/auth.types';
import {
  CreateClienteUseCase,
  ListClientesUseCase,
  GetClienteUseCase,
  UpdateClienteUseCase,
  DeleteClienteUseCase,
} from '../application/use-cases/cliente.use-cases';

@Controller('clientes')
@UseGuards(JwtAuthGuard)
export class ClienteController {
  constructor(
    @Inject(CreateClienteUseCase) private readonly createUseCase: CreateClienteUseCase,
    @Inject(ListClientesUseCase) private readonly listUseCase: ListClientesUseCase,
    @Inject(GetClienteUseCase) private readonly getUseCase: GetClienteUseCase,
    @Inject(UpdateClienteUseCase) private readonly updateUseCase: UpdateClienteUseCase,
    @Inject(DeleteClienteUseCase) private readonly deleteUseCase: DeleteClienteUseCase
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateClienteDto) {
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
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClienteDto) {
    return this.updateUseCase.execute(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteUseCase.execute(id);
  }
}
