# Schema do banco de dados — Ideal Jairo Mecânica Automotiva

Este documento define o modelo planejado do Cloud Firestore. O frontend atual ainda usa dados locais; a integração deverá converter os nomes e datas descritos aqui antes da gravação.

## Convenções

- Cada documento usa o ID gerado pelo Firestore; o ID não é repetido como campo.
- Datas de auditoria usam `Timestamp`, nunca horário fornecido pelo navegador.
- Documentos internos usam `criadoEm`, `atualizadoEm`, `criadoPor` e `atualizadoPor`.
- Valores monetários são `number` em reais, arredondados no servidor para duas casas.
- CPF/CNPJ, telefone e placa são normalizados e validados no servidor.
- Relações são referências por ID, sem leitura automática em cascata.
- Fotos nunca ficam em base64 no Firestore; são guardadas no R2 e o Firestore mantém metadados/chaves.
- Exclusões que afetem histórico financeiro ou fiscal devem preferir anonimização/arquivamento e gerar auditoria.

## Autenticação e perfis

O Firebase Authentication identifica o usuário. A autorização usa custom claims atribuídas exclusivamente no servidor:

```json
{ "perfil": "admin", "ativo": true }
```

Perfis válidos: `admin`, `tecnico`, `administrativo` e `mecanico`. O campo visual em `usuarios/{uid}` não concede acesso sozinho.

## Coleções

### `clientes/{clienteId}`

| Campo | Tipo | Obrigatório | Observação |
|---|---|---:|---|
| `nome` | string | sim | 3–120 caracteres |
| `cpfCnpj` | string | sim | Normalizado |
| `telefone` | string | sim | Validado |
| `email` | string | não | E-mail válido |
| `cep`, `endereco`, `numero`, `bairro`, `cidade`, `uf` | string | não | Endereço |
| `observacoes` | string | não | Até 1.000 caracteres |
| `consentimentoLgpd` | boolean | sim | Consentimento aplicável |
| `criadoEm`, `atualizadoEm` | Timestamp | sim | Gerados no servidor |
| `criadoPor`, `atualizadoPor` | string | sim | UID do usuário |

Um cliente possui veículos, ordens, orçamentos e contas a receber.

### `veiculos/{veiculoId}`

| Campo | Tipo | Obrigatório | Observação |
|---|---|---:|---|
| `clienteId` | string | sim | Relação com `clientes/{clienteId}` |
| `placa` | string | sim | Única, formato antigo ou Mercosul |
| `marca`, `modelo` | string | sim | Identificação |
| `ano` | integer | sim | 1900 até o próximo ano |
| `cor`, `motor`, `chassi` | string | não | Dados complementares |
| `km` | number | sim | 0–3.000.000 |
| `observacoes` | string | não | Até 1.000 caracteres |
| `criadoEm`, `atualizadoEm` | Timestamp | sim | Auditoria temporal |
| `criadoPor`, `atualizadoPor` | string | sim | UID do usuário |

### `ordens_de_servico/{ordemId}` e `orcamentos/{orcamentoId}`

| Campo | Tipo | Obrigatório | Observação |
|---|---|---:|---|
| `numero` | string | sim | Sequencial gerado em transação no servidor |
| `tipo` | string | sim | `os` ou `orcamento`, conforme a coleção |
| `clienteId`, `veiculoId` | string | sim | Relações com cliente e veículo |
| `status` | string | sim | Fluxo operacional definido no sistema |
| `aprovacao` | string | sim | Aguardando, aprovado, parcial ou recusado |
| `prioridade` | string | sim | Baixa, média ou alta |
| `emissao`, `previsao`, `saida` | Timestamp | conforme etapa | Datas do processo |
| `km` | number | sim | Hodômetro |
| `reclamacao`, `diagnostico`, `observacoes` | string | não | Até 2.000 caracteres cada |
| `garantiaDias` | integer | sim | 0–3.650 |
| `mecanicoId` | string | não | Relação com `usuarios/{uid}` |
| `itens` | array de ItemOS | sim | Máximo recomendado: 200 |
| `descontoGeral` | number | sim | Revalidado no servidor |
| `checklistEntradaId`, `checklistSaidaId` | string | não | Relações com `checklists` |
| `criadoEm`, `atualizadoEm` | Timestamp | sim | Auditoria temporal |
| `criadoPor`, `atualizadoPor` | string | sim | UID do usuário |

`ItemOS`: `{ id, tipo, descricao, quantidade, valorUnitario, custoUnitario, desconto, origem, mecanicoId?, aprovado, pecaId? }`.

Totais, margem, baixa de estoque e conta a receber são recalculados em transação no servidor. Converter orçamento cria uma nova OS com `orcamentoOrigemId` e impede duplicidade.

### `estoque/{pecaId}`

Campos: `nome: string`, `codigo?: string`, `marca?: string`, `fornecedor?: string`, `custo: number`, `precoVenda: number`, `quantidade: number`, `estoqueMinimo: number`, `localizacao?: string`, `observacoes?: string`, `criadoEm: Timestamp`, `atualizadoEm: Timestamp`.

Movimentações futuras ficam em `estoque/{pecaId}/movimentacoes/{movimentoId}` para rastrear entrada, saída, ajuste, OS e usuário.

### `compras/{compraId}`

Campos: `ordemServicoId?: string`, `descricao: string`, `fornecedor: string`, `quantidade: number`, `valorPago: number`, `valorVenda: number`, `status: string`, `dataSolicitacao: Timestamp`, `previsaoEntrega?: Timestamp`, `nota?: string`, `paraEstoque: boolean`, campos de auditoria.

Receber uma compra, aumentar estoque e criar conta a pagar ocorre numa transação no servidor.

### Financeiro

- `financeiro/contas_a_receber/lancamentos/{lancamentoId}`
- `financeiro/contas_a_pagar/lancamentos/{lancamentoId}`

Campos: `tipo: "receber" | "pagar"`, `descricao: string`, `valor: number`, `vencimento: Timestamp`, `pagoEm?: Timestamp`, `formaPagamento: string`, `categoria: string`, `ordemServicoId?: string`, `clienteId?: string`, campos de auditoria.

### `usuarios/{uid}`

Campos: `nome: string`, `email: string`, `perfil: string`, `ativo: boolean`, `criadoEm: Timestamp`, `atualizadoEm: Timestamp`. O ID é o UID do Firebase Authentication. Somente uma operação administrativa server-side pode atualizar documento e custom claims conjuntamente.

### `agendamentos/{agendamentoId}`

Campos: `nome`, `cpfCnpj`, `telefone`, `email?`, `endereco?`, `placa`, `marca`, `modelo`, `ano`, `km`, `servico`, `descricao?`, `data: "YYYY-MM-DD"`, `hora: "HH:mm"`, `status`, `consentimentoLgpd`, `criadoEm`, `atualizadoEm`.

A criação pública começa como `Pendente` e nunca permite leitura pública. Em produção, deve passar por uma função server-side com App Check, limite por IP/horário e verificação de disponibilidade.

### `checklists/{checklistId}`

Campos: `ordemServicoId: string`, `tipo: "entrada" | "saida"`, `hodometro: number`, `combustivel: string`, `itens: map<string, string>`, `observacoes: string`, `fotos: Foto[]`, campos de auditoria.

`Foto`: `{ chave, url, mimeType, tamanhoBytes, largura, altura, hash, criadoEm }`. O bucket R2 deve ser privado e as URLs assinadas devem expirar.

### `auditoria/{eventoId}`

Campos: `colecao`, `registroId`, `acao`, `usuarioId`, `data` e `detalhe?`. Eventos são somente criação e não podem ser alterados ou apagados pelo aplicativo.

### `configuracoes/oficina`

Campos: `diasAtendimento: integer[]`, `horaInicio`, `horaFim`, `intervaloMinutos`, `limitePorHorario`, `diasBloqueados: string[]`, `servicos: string[]`, `atualizadoEm`, `atualizadoPor`. Somente administrador altera.

## Índices recomendados

- `veiculos`: `clienteId ASC, placa ASC`.
- `ordens_de_servico`: `status ASC, emissao DESC`; `clienteId ASC, emissao DESC`; `veiculoId ASC, emissao DESC`; `mecanicoId ASC, status ASC`.
- `orcamentos`: `aprovacao ASC, emissao DESC`.
- `agendamentos`: `data ASC, hora ASC`; `status ASC, data ASC`.
- `compras`: `status ASC, dataSolicitacao DESC`; `ordemServicoId ASC, dataSolicitacao DESC`.
- Cada subcoleção financeira: `pagoEm ASC, vencimento ASC`; `clienteId ASC, vencimento DESC`.

Crie apenas os índices exigidos pelas consultas reais para controlar custo.

## Ambientes e ativação

### Desenvolvimento local

1. Preencha `.env.local` com os nomes de `.env.example`.
2. Obtenha os valores em **Firebase > Configurações do projeto > Geral > Seus aplicativos**.
3. Ative Authentication, Cloud Firestore e, somente se usado, Firebase Storage.
4. Publique `firestore.rules` com a Firebase CLI e teste no Emulator Suite antes de usar dados reais.

### Produção na Vercel

1. Abra **Settings > Environment Variables** no projeto da Vercel.
2. Cadastre cada variável de `.env.example` em **Preview** e **Production**.
3. Use valores de projetos Firebase separados para teste e produção.
4. Nunca use `VITE_` em credenciais administrativas: esse prefixo torna o valor público no navegador.
5. Faça a publicação com `npm run deploy`.

## Segurança e custo

- Regras do Firestore não substituem validação de negócio no servidor.
- Custom claims só podem ser atribuídas em código administrativo confiável.
- Estoque, compras, financeiro, aprovação e finalização de OS exigem transações server-side e idempotência.
- R2: bucket privado, URLs assinadas curtas, validação de MIME/tamanho, chaves por OS e política de exclusão LGPD.
- Ative App Check, limites de uso, alertas de orçamento e backups regulares.