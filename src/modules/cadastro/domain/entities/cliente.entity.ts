import { DomainException } from '../../../../shared/domain/exceptions/domain.exception';
import { CpfCnpjVo, TipoDocumento } from '../value-objects/cpf-cnpj.vo';
import { ContatoVo } from '../value-objects/contato.vo';

export interface ClienteProps {
  id: string;
  nome: string;
  contato: ContatoVo;
  cpfCnpj: CpfCnpjVo;
}

export class Cliente {
  private readonly _id: string;
  private readonly _nome: string;
  private readonly _contato: ContatoVo;
  private readonly _cpfCnpj: CpfCnpjVo;

  private constructor(props: ClienteProps) {
    this._id = props.id;
    this._nome = props.nome;
    this._contato = props.contato;
    this._cpfCnpj = props.cpfCnpj;
  }

  get id(): string {
    return this._id;
  }

  get nome(): string {
    return this._nome;
  }

  get contato(): ContatoVo {
    return this._contato;
  }

  get cpfCnpj(): CpfCnpjVo {
    return this._cpfCnpj;
  }

  static criar(props: {
    id: string;
    nome: string;
    email: string;
    telefone?: string;
    documento: string;
    tipoDocumento: TipoDocumento;
  }): Cliente {
    if (!props.id) {
      throw new DomainException('ID é obrigatório');
    }
    if (!props.nome || props.nome.trim().length === 0) {
      throw new DomainException('Nome é obrigatório');
    }

    const contato = ContatoVo.criar(props.email, props.telefone);
    const cpfCnpj = CpfCnpjVo.criar(props.documento, props.tipoDocumento);

    return new Cliente({
      id: props.id,
      nome: props.nome.trim(),
      contato,
      cpfCnpj,
    });
  }

  equals(other: Cliente): boolean {
    return this._id === other._id;
  }
}
