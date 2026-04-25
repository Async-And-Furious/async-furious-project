import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { PlacaVeiculoVo } from '../value-objects/placa-veiculo.vo';

export interface VeiculoProps {
  id: string;
  placa: PlacaVeiculoVo;
  marca: string;
  modelo: string;
  ano: number;
  cor: string | null;
  clienteId: string;
}

export class Veiculo {
  private readonly _id: string;
  private readonly _placa: PlacaVeiculoVo;
  private readonly _marca: string;
  private readonly _modelo: string;
  private readonly _ano: number;
  private readonly _cor: string | null;
  private readonly _clienteId: string;

  private constructor(props: VeiculoProps) {
    this._id = props.id;
    this._placa = props.placa;
    this._marca = props.marca;
    this._modelo = props.modelo;
    this._ano = props.ano;
    this._cor = props.cor;
    this._clienteId = props.clienteId;
  }

  get id(): string {
    return this._id;
  }

  get placa(): PlacaVeiculoVo {
    return this._placa;
  }

  get marca(): string {
    return this._marca;
  }

  get modelo(): string {
    return this._modelo;
  }

  get ano(): number {
    return this._ano;
  }

  get cor(): string | null {
    return this._cor;
  }

  get clienteId(): string {
    return this._clienteId;
  }

  static criar(props: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    ano: number;
    cor?: string;
    clienteId: string;
  }): Veiculo {
    if (!props.id) {
      throw new DomainException('ID e obrigatorio');
    }
    if (!props.marca || props.marca.trim().length === 0) {
      throw new DomainException('Marca e obrigatoria');
    }
    if (!props.modelo || props.modelo.trim().length === 0) {
      throw new DomainException('Modelo e obrigatorio');
    }
    if (props.ano < 1900 || props.ano > new Date().getFullYear() + 1) {
      throw new DomainException('Ano invalido');
    }

    const placa = PlacaVeiculoVo.criar(props.placa);

    return new Veiculo({
      id: props.id,
      placa,
      marca: props.marca.trim(),
      modelo: props.modelo.trim(),
      ano: props.ano,
      cor: props.cor || null,
      clienteId: props.clienteId,
    });
  }

  equals(other: Veiculo): boolean {
    return this._id === other._id;
  }
}
