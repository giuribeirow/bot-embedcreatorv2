import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { store } from '../config/store.js';

export function mainPanelPayload(client) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Painel Administrativo')
    .setDescription('Configure o bot ou monte mensagens profissionais sem precisar editar JSON.')
    .addFields(
      { name: '⚙️ Config Bot', value: 'Perfil, status, presença, rotação e permissões.', inline: false },
      { name: '🎨 Montador de Mensagem', value: 'Mensagem normal, Embed tradicional e Components V2.', inline: false },
    )
    .setFooter({ text: 'by @r8fb' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('panel:config').setLabel('Config Bot').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('panel:builder').setLabel('Montador de Mensagem').setEmoji('🎨').setStyle(ButtonStyle.Primary),
  );
  return { embeds: [embed], components: [row] };
}

export function configPanelPayload(client) {
  const rot = store.data.rotation;
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('⚙️ Config Bot')
    .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
    .setDescription('Use os controles abaixo. Todas as alterações administrativas são validadas novamente por permissão.')
    .addFields(
      { name: 'Status', value: store.data.status ?? 'online', inline: true },
      { name: 'Presença', value: store.data.presence ? `${store.data.presence.type} • ${store.data.presence.name}` : 'Nenhuma', inline: true },
      { name: 'Rotação', value: rot.enabled ? `Ativa • ${rot.activities.length} atividade(s) • ${rot.intervalSeconds}s` : `Desativada • ${rot.activities.length} atividade(s)`, inline: false },
      { name: 'Proprietário', value: store.data.ownerId ? `<@${store.data.ownerId}>` : 'Não definido', inline: true },
      { name: 'Autorizados', value: `${store.data.authorizedUsers.length} usuário(s) • ${store.data.authorizedRoles.length} cargo(s)`, inline: true },
    )
    .setFooter({ text: 'by @r8fb' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('config:profile').setLabel('Perfil').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('config:status').setLabel('Status').setEmoji('🟢').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('config:presence').setLabel('Presença').setEmoji('🎮').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('config:rotation').setLabel('Status Rotativo').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('config:permissions').setLabel('Permissões').setEmoji('🔐').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('panel:home').setLabel('Voltar').setEmoji('⬅️').setStyle(ButtonStyle.Primary),
  );
  return { embeds: [embed], components: [row1, row2] };
}
