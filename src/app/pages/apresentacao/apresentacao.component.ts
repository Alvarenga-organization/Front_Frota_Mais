import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NomeIconeTraco } from '../../compartilhado/vitrine/icones-traco';

interface Recurso {
  titulo: string;
  descricao: string;
  icone: NomeIconeTraco;
}

/**
 * Página inicial pública (antes do login). Referência visual: design/Inicio.dc.html.
 * Os textos descrevem só o que o Frota+ faz hoje; o protótipo citava funções inexistentes
 * (rastreamento ao vivo, CNH, documentos), trocadas por recursos reais.
 */
@Component({
  selector: 'app-apresentacao',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './apresentacao.component.html',
  styleUrls: ['./apresentacao.component.css']
})
export class ApresentacaoComponent {
  readonly ano = new Date().getFullYear();

  readonly recursos: readonly Recurso[] = [
    { titulo: 'Caminhões', descricao: 'Placa, modelo, eixos e situação de cada caminhão organizados em um só lugar.', icone: 'caminhao' },
    { titulo: 'Motoristas', descricao: 'Convide seus motoristas e vincule cada um aos caminhões que ele dirige.', icone: 'motorista' },
    { titulo: 'Viagens', descricao: 'Cada frete com origem, destino, valor e a quilometragem vazia e carregada.', icone: 'rota' },
    { titulo: 'Abastecimentos', descricao: 'Diesel e Arla lançados na viagem, direto do celular do motorista.', icone: 'combustivel' },
    { titulo: 'Pedágios e despesas', descricao: 'Registre os pedágios e as despesas extras de cada frete.', icone: 'recibo' },
    { titulo: 'Rentabilidade', descricao: 'Veja o resultado de cada frete e do período, com as manutenções da frota.', icone: 'grafico' }
  ];

  readonly passos = [
    { titulo: 'Crie sua conta', descricao: 'Cadastre sua empresa e o seu acesso de dono.' },
    { titulo: 'Cadastre caminhões e motoristas', descricao: 'Informe os caminhões e convide os motoristas por e-mail.' },
    { titulo: 'Lance as viagens', descricao: 'Abastecimentos, pedágios e despesas de cada frete, e o resultado no painel.' }
  ] as const;

  readonly beneficios = [
    'Resultado de cada frete com diesel, pedágios e despesas',
    'Quilometragem vazia e carregada separadas em cada viagem',
    'Motorista lança pelo celular, sem acesso aos números financeiros',
    'Manutenções no resultado do período de cada caminhão'
  ] as const;
}
