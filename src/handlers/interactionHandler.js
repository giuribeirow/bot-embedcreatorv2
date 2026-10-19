import { MessageFlags } from 'discord.js';
import { guardInteraction } from '../security/permissions.js';
import { mainPanelPayload } from '../panel/mainPanel.js';
import { handleConfigInteraction } from './configHandler.js';
import { handleBuilderInteraction } from './builderHandler.js';

async function handlePublished(i) {
  const id = i.customId ?? '';
  if (id.startsWith('pubbtn:') || id.startsWith('pubv2') || id.startsWith('pubv2sec:')) {
    const action = id.split(':').slice(1).join(':') || 'botao';
    return i.reply({ content: `✅ Ação recebida: \`${action}\``, flags: MessageFlags.Ephemeral });
  }
  if (id.startsWith('pubsel:') || id.startsWith('pubv2sel:')) {
    const values = i.values?.length ? i.values.join(', ') : 'seleção recebida';
    return i.reply({ content: `✅ Seleção: ${values}`, flags: MessageFlags.Ephemeral });
  }
  return false;
}

export async function onInteraction(interaction) {
  try {
    if (!interaction.isButton() && !interaction.isAnySelectMenu() && !interaction.isModalSubmit()) return;

    if (await handlePublished(interaction)) return;

    const id = interaction.customId ?? '';
    const adminInteraction =
      id.startsWith('panel:') || id.startsWith('config:') || id.startsWith('profile:') ||
      id.startsWith('status:') || id.startsWith('presence:') || id.startsWith('rotation:') ||
      id.startsWith('perm:') || id.startsWith('modal:profile:') || id.startsWith('modal:presence') ||
      id.startsWith('modal:rotation:') || id.startsWith('modal:perm:') || id.startsWith('builder:') ||
      id.startsWith('modal:builder:');

    if (!adminInteraction) return;
    if (!await guardInteraction(interaction)) return;

    if (id === 'panel:home') return interaction.update(mainPanelPayload(interaction.client));

    const configPrefixes = ['panel:config','config:','profile:','status:','presence:','rotation:','perm:','modal:profile:','modal:presence','modal:rotation:','modal:perm:'];
    if (configPrefixes.some(prefix => id.startsWith(prefix))) {
      const handled = await handleConfigInteraction(interaction);
      if (handled !== false) return;
    }

    const builderPrefixes = ['panel:builder','builder:','modal:builder:'];
    if (builderPrefixes.some(prefix => id.startsWith(prefix))) {
      const handled = await handleBuilderInteraction(interaction);
      if (handled !== false) return;
    }
  } catch (error) {
    console.error('[INTERACTION]', error);
    const content = `❌ Ocorreu um erro: ${error.message ?? 'erro desconhecido'}`;
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    } catch {}
  }
}
