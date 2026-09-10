# Feijoada da Dayse — fase 2

Aplicação web responsiva da Feijoada da Dayse. Esta pasta parte da interface modernizada da fase 1 e acrescenta contas de clientes, pedidos acompanháveis, notificações, rankings, fidelidade, jogo ampliado, painel operacional e estrutura segura no Firebase.

## Executar localmente

O frontend é estático e não precisa de build. Sirva a raiz por HTTP:

```powershell
py -m http.server 4174
```

Acesse `http://127.0.0.1:4174/Index.html`.

## Validar

```powershell
npm run validate
```

O comando verifica a sintaxe dos módulos e das Cloud Functions e executa os testes das regras puras de catálogo, carrinho, checkout, funcionamento, pedidos, ranking, fidelidade e jogo.

Para instalar e conferir as dependências das funções:

```powershell
cd functions
npm install
npm run check
```

As funções usam Node.js 20 em produção. Uma versão local mais nova pode exibir apenas um aviso de engine.

## Recursos implementados

- cadastro e login com e-mail/senha, login Google, sessão persistente e recuperação de senha;
- perfil, preferências de privacidade, endereços com padrão único, favoritos e solicitação de exclusão;
- compra como visitante preservada e pedido autenticado criado por Cloud Function com preço e disponibilidade relidos no servidor;
- histórico, repetição com preços atuais, barra de pedido ativo e linha do tempo por status;
- central interna de notificações, leitura individual/em lote e base para push por aparelho;
- rankings semanal/geral do jogo e mensal/geral de clientes, sempre dependentes de consentimento;
- fidelidade por pedido entregue, configurável no painel;
- Corre, Feijão! com combo, feijão dourado, power-ups, escudo, som opcional e validação de pontuação no servidor;
- painel administrativo com visão do dia, fila, busca/filtros, avanço seguro de status, clientes, catálogo e configurações;
- pedido oficial pelo site para clientes cadastrados ou visitantes com sessão anônima, com WhatsApp apenas como apoio;
- alerta de novo pedido no painel e preparação para push administrativo fora da página;
- painel financeiro gerencial por período, com faturamento de entregues, ticket médio, pagamentos, fretes e produtos vendidos;
- papel de entregador definido ou removido pelo próprio painel, atribuição de entregas, contatos do cliente, atalhos Waze/Google Maps e etapas de saída, chegada e entrega;
- rastreamento temporário pelo Realtime Database enquanto a página do entregador permanecer ativa, com acesso limitado ao cliente, entregador atribuído e administrador;
- regras Firestore com custom claim administrativo, índices, PWA e cache apenas de arquivos públicos.

## Estrutura

- `Index.html` e `style.css`: interface e layouts responsivos.
- `js/app.mjs`: catálogo, sacola, checkout, overlays e integração geral.
- `js/customer.mjs`: conta, pedidos, notificações, rankings e operações administrativas.
- `js/core.mjs` e `js/account-core.mjs`: regras puras testáveis.
- `js/firebase.mjs`: Auth, Firestore, Messaging e chamadas das funções.
- `js/game.mjs`: jogo Canvas carregado sob demanda.
- `functions/index.js`: criação de pedido, status, fidelidade, ranking, notificações e validação de score.
- `firestore.rules` e `firestore.indexes.json`: autorização e consultas.
- `firebase-messaging-sw.js` e `manifest.webmanifest`: PWA e push em segundo plano.
- `tests/`: testes automatizados sem dependências de navegador.

## Configuração Firebase necessária

Antes de publicar em produção:

1. No Authentication, habilite **E-mail/senha**, **Google** e **Anônimo** e cadastre o domínio da loja. O acesso anônimo cria a sessão segura dos pedidos feitos sem cadastro.
2. Instale a Firebase CLI, autentique-se e selecione o projeto `feijoadadadayse-a074d`.
3. Em `functions`, execute `npm install`.
4. Publique regras, índices, funções e hosting com `firebase deploy`.
   Antes disso, crie a instância padrão do Realtime Database e confirme que sua URL corresponde à meta `firebase-database-url` de `Index.html`.
5. Atribua a custom claim de administrador somente às contas autorizadas usando `node functions/scripts/set-admin.mjs EMAIL` com credenciais administrativas locais.
6. Cadastre cada conta autorizada de entregador usando `node functions/scripts/set-courier.mjs EMAIL`. O script aplica a claim e registra o papel utilizado na atribuição de pedidos.
7. Para Web Push, gere uma chave Web Push no Firebase Console e preencha o conteúdo da meta `firebase-vapid-key` em `Index.html`.
8. Ative App Check depois de registrar os domínios e validar o fluxo; as funções já autenticam usuário, administrador e entregador, mas `enforceAppCheck` permanece desativado até essa configuração externa.

Não coloque chaves privadas ou arquivos de conta de serviço no repositório. A configuração Firebase existente no frontend é a configuração pública prevista pelo SDK web.

## Modelo de dados principal

- `users/{uid}` e subcoleções `addresses`, `favorites`, `notifications`, `pushTokens`;
- `orders/{orderId}` com snapshot dos itens, totais e `statusHistory`;
- `gameSessions/{id}`, `gameScores/{uid}` e `customerStats/{uid}` escritos somente no servidor;
- `leaderboards/{game_weekly|game_all|customers_monthly|customers_all}` com dados públicos mínimos;
- `notificationEvents/{orderId_status}` para idempotência;
- `settings/main` para pausa, fidelidade e temporada.

## Limites deliberados

- O site é o canal oficial do pedido. O WhatsApp permanece como suporte e contingência caso a criação segura do pedido esteja indisponível.
- O cálculo de entrega permanece baseado na cotação do frontend e tem limites no servidor; para antifraude forte, conecte uma API de roteamento confiável também na Cloud Function.
- A solicitação de exclusão registra o pedido para tratamento administrativo; a remoção definitiva deve respeitar retenção fiscal/legal e também apagar o usuário no Authentication.
- Notificações push só funcionam em HTTPS (ou localhost), com permissão do navegador e chave VAPID configurada.
- O rastreamento pelo navegador pode ser suspenso quando Waze/Google Maps fica em primeiro plano ou quando a tela é bloqueada; a tela do cliente informa a última atualização recebida, sem apresentar uma posição antiga como atual.
