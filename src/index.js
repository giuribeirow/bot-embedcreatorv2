import 'dotenv/config';
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { bootstrapOwnerFromEnv, isAuthorized } from './security/permissions.js';
import { mainPanelPayload } from './panel/mainPanel.js';
import { startRotation } from './presence/rotation.js';
import { onInteraction } from './handlers/interactionHandler.js';

const token = process.env.DISCORD_TOKEN?.trim();
if (!token || token === 'COLOQUE_O_TOKEN_DO_BOT') {
  console.error('[ERRO] DISCORD_TOKEN não configurado. Edite o .env.');
  process.exit(1);
}

bootstrapOwnerFromEnv();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  allowedMentions: { parse: [], repliedUser: false },
});

client.once(Events.ClientReady, ready => {
  console.log('============================================================');
  console.log(` [OK] Bot conectado como ${ready.user.tag}`);
  console.log(' [OK] Comando principal: !painel');
  console.log('============================================================');
  startRotation(client);
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  if (message.content.trim() !== '!painel') return;

  if (!await isAuthorized(message)) {
    const denied = await message.reply('❌ Você não possui acesso a este painel.').catch(() => null);
    if (denied) setTimeout(() => denied.delete().catch(() => {}), 6000);
    return;
  }

  await message.reply(mainPanelPayload(client));
});

client.on(Events.InteractionCreate, onInteraction);

client.on('error', error => console.error('[CLIENT]', error));
process.on('unhandledRejection', error => console.error('[UNHANDLED]', error));
process.on('uncaughtException', error => console.error('[UNCAUGHT]', error));

client.login(token).catch(error => {
  console.error('[LOGIN] Falha ao entrar no Discord:', error.message);
  process.exit(1);
});
