export class Servico {
  id!: string;
  nome!: string;
  descricao!: string | null;
  preco!: number;
  created_at!: Date;
  updated_at!: Date;

  static reconstituir(props: {
    id: string;
    nome: string;
    descricao: string | null;
    preco: number;
    created_at: Date;
    updated_at: Date;
  }): Servico {
    const servico = new Servico();
    servico.id = props.id;
    servico.nome = props.nome;
    servico.descricao = props.descricao;
    servico.preco = props.preco;
    servico.created_at = props.created_at;
    servico.updated_at = props.updated_at;
    return servico;
  }
}
