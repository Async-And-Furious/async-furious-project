import { Veiculo } from '../../domain/entities/veiculo.entity';

export class VeiculoResponseDto {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  cor: string | null;
  clienteId: string;

  static fromDomain(veiculo: Veiculo): VeiculoResponseDto {
    const dto = new VeiculoResponseDto();
    dto.id = veiculo.id;
    dto.placa = veiculo.placa.formato;
    dto.marca = veiculo.marca;
    dto.modelo = veiculo.modelo;
    dto.ano = veiculo.ano;
    dto.cor = veiculo.cor;
    dto.clienteId = veiculo.clienteId;
    return dto;
  }
}

export class VeiculoListResponseDto {
  data: VeiculoResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  static fromDomain(
    veiculos: Veiculo[],
    pagination: { page: number; limit: number; total: number; totalPages: number }
  ): VeiculoListResponseDto {
    const dto = new VeiculoListResponseDto();
    dto.data = veiculos.map((v) => VeiculoResponseDto.fromDomain(v));
    dto.pagination = pagination;
    return dto;
  }
}
