# Oficina Conectada

Basicamente oque está no PDF é esse resumo abaixo mas lá eu expliquei melhor cada tópico: Cadastro de clientes e veículos; Consulta de placa; Agendamento online; Agenda da oficina; OS (ordem de serviço) - anexei um exemplo de note de serviço que deve ser, mas não pode ter esses espaços em branco. Orçamento com aprovação; Estoque; Compras de peças; Peças vinculadas à OS; Financeiro; Contas a pagar/receber; Relatórios; Usuários e permissões; Checklist com fotos; WhatsApp; Histórico dos veículos; Backup; LGPD; Vários cálculos automáticos.

além do resumão e do exemplo de nota de serviço que anexei, também anexei a logo.

banco de dados usaremos Firebase, com foco em otimização e custo baixo mensal (atualmente a empresa paga 75,00 reais por mês em um software que já dá tudo, precisamos que o custo seja de menos de 10 reais por mês ou menos de 20 reais, se for possível, que coloquem 40 reais e dure 3 a 6 meses). A hospedagem que vão usar é da VERCEL, então, sempre que eu for fazer deploy será “npm rum deploy”.

O backend NUNCA DEVE CONFIAR no frontend, então tudo terá que ter validação, mas o ADMIN pode fazer tudo (de acordo com as leis da LGPD). 

Vamos começar fazendo apenas o FRONTEND e vamos deixar o BACKEND apenas estruturado e montado para receber as keys e tudo do firebase. Lembrando: tudo deve ser validade, cada ação do usuário. O sistema deve ser fluido e automatizado (por isso me contrataram), a parte de storage (que é onde receberá as fotos) deve ser otimizada para poder receber diversas fotos e ter um custo de centavos ou até 5 reais por mês (caso seja possível), ou indique outros lugares que podemos armazenar as imagens para que não haja custo algum com essas imagens.

Ao final dessa primeira sessão, informe o que falta para prosseguirmos com o projeto e terminar.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/62a78d28-6f09-42b5-8ac0-b6e6c0d415b5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
