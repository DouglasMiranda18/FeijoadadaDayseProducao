# Feijoada da Dayse — aplicativo do entregador

Aplicativo nativo separado do site, conectado ao mesmo Firebase. O acesso é permitido somente às contas marcadas como entregador no painel administrativo.

## O que já funciona

- Login e recuperação de senha pelo Firebase Authentication.
- Validação da permissão `courier` antes de abrir o aplicativo.
- Lista em tempo real dos pedidos atribuídos ao entregador.
- Contato com o cliente por telefone e WhatsApp.
- Abertura da rota no Waze ou Google Maps.
- Lembrete obrigatório de bebidas antes de iniciar a corrida.
- Mudanças de status: iniciar entrega, avisar que chegou e confirmar entrega.
- Avisos ao cliente usando as mesmas Cloud Functions do site.
- GPS em primeiro e segundo plano durante a entrega ativa.
- Notificação permanente no Android enquanto o rastreamento estiver ligado.
- Indicador de localização ativa no iPhone.
- Trajeto enviado ao Realtime Database e exibido no mapa do cliente.

## Teste e compilação

O rastreamento em segundo plano exige um aplicativo nativo. Ele **não funciona corretamente no Expo Go**.

```powershell
cd entregador-app
npm install
npx expo prebuild
npx expo run:android
```

Para iPhone é necessário um Mac com Xcode, ou uma conta Expo/EAS para compilar na nuvem. Para publicar nas lojas também são necessárias as contas Google Play Console e Apple Developer.

## Comportamento do GPS

A localização é iniciada somente depois de tocar em **Iniciar entrega** e conceder a permissão “Sempre”. Ela para ao tocar em **Cheguei ao endereço** ou **Confirmar entrega**. Android e iOS podem interromper qualquer aplicativo se o usuário escolher “Forçar parada”; no Android, desativar a otimização de bateria para este aplicativo melhora a continuidade em aparelhos mais agressivos.
