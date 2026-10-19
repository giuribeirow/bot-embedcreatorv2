import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder,
} from 'discord.js';
import { summaryText } from '../builder/render.js';

export function builderChooserPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎨 Montador de Mensagem')
    .setDescription('Escolha o formato que deseja montar. Cada administrador possui sua própria sessão.')
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('builder:type:normal').setLabel('Mensagem Normal').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('builder:type:embed').setLabel('Embed Normal').setEmoji('🎨').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('builder:type:v2').setLabel('Components V2').setEmoji('🧩').setStyle(ButtonStyle.Success),
  );
  const back = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('panel:home').setLabel('Voltar').setEmoji('⬅️').setStyle(ButtonStyle.Secondary));
  return { embeds: [embed], components: [row, back] };
}

function structureText(session) {
  if (session.type === 'v2') {
    if (!session.blocks.length) return 'Nenhum bloco ainda.';
    return session.blocks.slice(0, 20).map((b, i) => `${String(i + 1).padStart(2, '0')} • ${labelBlock(b.type)}`).join('\n');
  }
  const parts = [];
  if (session.type === 'normal' && session.content) parts.push('01 • Conteúdo');
  if (session.type === 'embed') {
    const e = session.embed;
    for (const [key, label] of [['title','Título'],['description','Descrição'],['author','Autor'],['thumbnail','Thumbnail'],['image','Imagem'],['footer','Rodapé']]) if (e[key]) parts.push(`${String(parts.length + 1).padStart(2,'0')} • ${label}`);
    e.fields.forEach((f, i) => parts.push(`${String(parts.length + 1).padStart(2,'0')} • Campo: ${f.name || i + 1}`));
  }
  session.buttons.forEach((b, i) => parts.push(`${String(parts.length + 1).padStart(2,'0')} • Botão: ${b.label || i + 1}`));
  session.menus.forEach((m, i) => parts.push(`${String(parts.length + 1).padStart(2,'0')} • Menu: ${m.placeholder || i + 1}`));
  return parts.join('\n') || 'Nenhum elemento ainda.';
}

export function labelBlock(type) {
  return ({
    title: 'Título', text: 'Texto', separator: 'Separador', image: 'Imagem', gallery: 'Media Gallery',
    section: 'Section', thumbnail: 'Thumbnail/Section', container: 'Container', file: 'File', buttons: 'Action Row / Botões', menu: 'Select Menu',
  })[type] ?? type;
}

export function editorPayload(session) {
  const typeName = session.type === 'normal' ? '📝 Mensagem Normal' : session.type === 'embed' ? '🎨 Embed Normal' : '🧩 Components V2';
  const embed = new EmbedBuilder()
    .setColor(session.type === 'v2' ? 0x57F287 : 0x5865F2)
    .setTitle(typeName)
    .setDescription(`**${summaryText(session)}**\n\n### 📚 Estrutura\n${structureText(session).slice(0, 3000)}\n\nO preview real é atualizado em uma mensagem privada separada.`)
    .setFooter({ text: 'Aegis Host' });

  const addOptions = session.type === 'normal'
    ? [
      { label: 'Conteúdo', value: 'content', emoji: '📝' },
      { label: 'Botão', value: 'button', emoji: '🔘' },
      { label: 'Menu', value: 'menu', emoji: '📋' },
    ]
    : session.type === 'embed'
      ? [
        { label: 'Título', value: 'title', emoji: '🏷️' }, { label: 'Descrição', value: 'description', emoji: '📝' },
        { label: 'Cor', value: 'color', emoji: '🎨' }, { label: 'Autor', value: 'author', emoji: '👤' },
        { label: 'Thumbnail', value: 'thumbnail', emoji: '🖼️' }, { label: 'Imagem', value: 'image', emoji: '🌄' },
        { label: 'Campo', value: 'field', emoji: '📑' }, { label: 'Rodapé', value: 'footer', emoji: '🔻' },
        { label: 'Timestamp', value: 'timestamp', emoji: '🕒' }, { label: 'Botão', value: 'button', emoji: '🔘' },
        { label: 'Menu', value: 'menu', emoji: '📋' },
      ]
      : [
        { label: 'Título', value: 'title', emoji: '🏷️' }, { label: 'Texto', value: 'text', emoji: '📝' },
        { label: 'Section', value: 'section', emoji: '🧱' }, { label: 'Thumbnail (via Section)', value: 'thumbnail', emoji: '🖼️' },
        { label: 'Imagem', value: 'image', emoji: '🌄' }, { label: 'Media Gallery', value: 'gallery', emoji: '🖼️' },
        { label: 'Separador', value: 'separator', emoji: '➖' }, { label: 'Container', value: 'container', emoji: '📦' },
        { label: 'File', value: 'file', emoji: '📎' }, { label: 'Botões', value: 'buttons', emoji: '🔘' }, { label: 'Select Menu', value: 'menu', emoji: '📋' },
      ];

  const addMenu = new StringSelectMenuBuilder().setCustomId('builder:add').setPlaceholder('➕ Adicionar/Editar').addOptions(addOptions.slice(0, 25));
  const row1 = new ActionRowBuilder().addComponents(addMenu);
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('builder:structure').setLabel('Estrutura').setEmoji('📚').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('builder:undo').setLabel('Desfazer').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('builder:remove').setLabel(session.type === 'v2' ? 'Remover último' : 'Remover').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('builder:preview').setLabel('Preview').setEmoji('👁️').setStyle(ButtonStyle.Primary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('builder:clear').setLabel('Limpar').setEmoji('🧹').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('builder:send').setLabel('Enviar').setEmoji('📤').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('panel:builder').setLabel('Trocar tipo').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row1, row2, row3] };
}
