import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder,
} from 'discord.js';
import { store } from '../config/store.js';

const backRow = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('panel:config').setLabel('Voltar').setEmoji('⬅️').setStyle(ButtonStyle.Secondary),
);

export function profileView(client) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🖼️ Perfil do Bot')
    .setDescription('Altere avatar ou banner por URL ou enviando uma imagem no canal quando solicitado.')
    .setThumbnail(client.user.displayAvatarURL({ size: 512 }))
    .addFields(
      { name: 'Avatar atual', value: client.user.displayAvatarURL({ size: 1024 }), inline: false },
      { name: 'Banner atual', value: client.user.bannerURL({ size: 1024 }) ?? 'Sem banner / indisponível', inline: false },
    )
    .setFooter({ text: 'by @r8fb' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('profile:avatar:url').setLabel('Avatar por URL').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('profile:avatar:file').setLabel('Enviar Avatar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('profile:banner:url').setLabel('Banner por URL').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('profile:banner:file').setLabel('Enviar Banner').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row, backRow()] };
}

export function statusView() {
  const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🟢 Status do Bot').setDescription(`Status atual: **${store.data.status}**`).setFooter({ text: 'by @r8fb' });
  const select = new StringSelectMenuBuilder().setCustomId('status:set').setPlaceholder('Escolha o status').addOptions(
    { label: 'Online', value: 'online', emoji: '🟢' },
    { label: 'Ausente', value: 'idle', emoji: '🌙' },
    { label: 'Não Perturbe', value: 'dnd', emoji: '⛔' },
    { label: 'Invisível', value: 'invisible', emoji: '⚫' },
  );
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(select), backRow()] };
}

export function presenceView() {
  const p = store.data.presence;
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎮 Presença / Atividade')
    .setDescription(p ? `Atual: **${p.type} • ${p.name}**` : 'Nenhuma presença configurada.')
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('presence:edit').setLabel(p ? 'Editar presença' : 'Criar presença').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('presence:remove').setLabel('Remover presença').setStyle(ButtonStyle.Danger).setDisabled(!p),
  );
  return { embeds: [embed], components: [row, backRow()] };
}

export function rotationView() {
  const r = store.data.rotation;
  const list = r.activities.length
    ? r.activities.map((a, i) => `${String(i + 1).padStart(2,'0')} • ${a.type} • ${a.name}`).join('\n')
    : 'Nenhuma atividade cadastrada.';
  const embed = new EmbedBuilder()
    .setColor(r.enabled ? 0x57F287 : 0x2B2D31)
    .setTitle('🔄 Status Rotativo')
    .setDescription(`**Estado:** ${r.enabled ? 'Ativo' : 'Desativado'}\n**Intervalo:** ${r.intervalSeconds}s\n\n${list.slice(0, 3500)}`)
    .setFooter({ text: 'by @aegishost' });
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rotation:add').setLabel('Adicionar').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rotation:edit').setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary).setDisabled(!r.activities.length),
    new ButtonBuilder().setCustomId('rotation:remove').setLabel('Remover').setEmoji('🗑️').setStyle(ButtonStyle.Danger).setDisabled(!r.activities.length),
    new ButtonBuilder().setCustomId('rotation:reorder').setLabel('Reorganizar').setEmoji('↕️').setStyle(ButtonStyle.Secondary).setDisabled(r.activities.length < 2),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rotation:toggle').setLabel(r.enabled ? 'Desativar rotação' : 'Ativar rotação').setStyle(r.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('rotation:interval').setLabel('Definir intervalo').setEmoji('⏱️').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row1, row2, backRow()] };
}

export function permissionsView() {
  const users = store.data.authorizedUsers.length ? store.data.authorizedUsers.map(id => `<@${id}>`).join('\n') : 'Nenhum.';
  const roles = store.data.authorizedRoles.length ? store.data.authorizedRoles.map(id => `<@&${id}>`).join('\n') : 'Nenhum.';
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🔐 Permissões do Painel')
    .addFields(
      { name: 'Proprietário', value: store.data.ownerId ? `<@${store.data.ownerId}>` : 'Não definido', inline: false },
      { name: 'Usuários autorizados', value: users.slice(0, 1000), inline: true },
      { name: 'Cargos autorizados', value: roles.slice(0, 1000), inline: true },
    )
    .setFooter({ text: 'by @67giu' });
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('perm:user:add').setLabel('Adicionar usuário').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('perm:user:remove').setLabel('Remover usuário').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('perm:role:add').setLabel('Adicionar cargo').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('perm:role:remove').setLabel('Remover cargo').setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('perm:owner').setLabel('Definir proprietário').setStyle(ButtonStyle.Primary),
  );
  return { embeds: [embed], components: [row1, row2, backRow()] };
}
