# Estrutura Firebase, segurança e documentação

## Objetivo
Preparar o projeto para receber as credenciais do Firebase em desenvolvimento e produção, sem incluir valores reais, e documentar o modelo de dados e as etapas ainda necessárias para colocar o sistema em operação.

## Implementação

1. **SDK e configuração do Firebase**
   - Instalar o SDK web oficial do Firebase.
   - Criar `src/lib/firebaseConfig.ts` para ler e validar todas as variáveis `VITE_FIREBASE_*`.
   - Criar `src/lib/firebase.ts` com inicialização única e exportações de Auth, Firestore e Storage, sem quebrar o modo demonstrativo quando as chaves ainda estiverem vazias.
   - Ajustar o adaptador existente para usar a configuração centralizada, mantendo o armazenamento local até a integração real das operações.

2. **Arquivos de ambiente**
   - Criar `.env.example` com API key, domínio de autenticação, project ID, bucket, messaging sender ID, app ID e measurement ID opcional, todos sem valores.
   - Criar `.env.local` vazio para desenvolvimento e garantir explicitamente que `.env.local` permaneça ignorado pelo Git.
   - Documentar onde cadastrar as mesmas variáveis nos ambientes Preview e Production da Vercel e confirmar o uso de `npm run deploy`.

3. **Regras do Firestore**
   - Criar `firestore.rules` com bloqueio global por padrão.
   - Usar o perfil armazenado em custom claims (`admin`, `tecnico`, `administrativo`, `mecanico`) e exigir usuário autenticado/ativo.
   - Definir acesso por coleção, com administrador total e permissões mínimas para os demais perfis.
   - Validar campos permitidos, tipos, limites, relacionamentos básicos e campos imutáveis em criação/alteração; proteger custos, financeiro, usuários, configurações e auditoria conforme o perfil.
   - Permitir somente a criação pública validada de agendamentos, sem liberar leitura pública.

4. **Schema e guia de ativação**
   - Criar `docs/database-schema.md` com coleções, campos, tipos, relações, índices sugeridos, padrão de IDs/datas, custom claims, auditoria e estratégia de fotos por URL.
   - Separar `ordens_de_servico` e `orcamentos`, além das subcoleções `financeiro/contas_a_receber/lancamentos` e `financeiro/contas_a_pagar/lancamentos`.
   - Registrar o passo a passo para configurar Firebase e Vercel, publicar as regras e executar o deploy.

5. **Validação**
   - Verificar tipagem/compilação e confirmar que o app continua funcionando sem credenciais reais.
   - Revisar as regras para garantir negação por padrão e ausência de segredos no repositório.

## Limites desta etapa
Esta etapa prepara a infraestrutura, mas não transforma os dados locais em persistência real. Ao final, será entregue uma lista objetiva do que ainda falta: autenticação real e atribuição segura de perfis, implementação das operações Firestore no servidor, migração dos dados, integração R2 com URLs assinadas, regras do R2, consulta de placa, WhatsApp, backup/restauração, auditoria LGPD, testes das regras e validação final em produção.

## Detalhes técnicos
- As variáveis `VITE_FIREBASE_*` são configuração pública do cliente Firebase; nenhuma chave administrativa será adicionada ao frontend.
- Regras do Firestore reduzem acesso indevido, mas cálculos financeiros, estoque, transações e ações administrativas continuarão exigindo validação server-side antes do sistema ser considerado pronto para produção.
