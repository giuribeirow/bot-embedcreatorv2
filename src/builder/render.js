import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ContainerBuilder,
  EmbedBuilder,
  FileBuilder,
  MediaGalleryBuilder,
  MentionableSelectMenuBuilder,
  MessageFlags,
  RoleSelectMenuBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  UserSelectMenuBuilder,
} from 'discord.js';
import { isHttpUrl } from '../utils/validation.js';

const styleMap = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  link: ButtonStyle.Link,
};

function safeCustomId(base, fallback) {
  const clean = String(base || fallback).replace(/[^a-zA-Z0-9:_\-.]/g, '_').slice(0, 80);
  return clean || fallback;
}

function buildButton(data, index, scope = 'pubbtn') {
  const button = new ButtonBuilder()
    .setLabel(String(data.label || 'Botão').slice(0, 80))
    .setStyle(styleMap[data.style] ?? ButtonStyle.Secondary)
    .setDisabled(Boolean(data.disabled));

  if (data.emoji) button.setEmoji(data.emoji);
  if (data.style === 'link') {
    if (!isHttpUrl(data.url)) throw new Error(`Botão "${data.label || index + 1}" precisa de URL válida.`);
    button.setURL(data.url);
  } else {
    button.setCustomId(`${scope}:${safeCustomId(data.customId, `button_${index + 1}`)}`.slice(0, 100));
  }
  return button;
}

function buildMenu(data, index, scope = 'pubsel') {
  const customId = `${scope}:${safeCustomId(data.customId, `menu_${index + 1}`)}`.slice(0, 100);
  const placeholder = String(data.placeholder || 'Selecione uma opção').slice(0, 150);
  const min = Math.max(0, Number(data.min ?? 1));
  const max = Math.max(min || 1, Number(data.max ?? 1));

  if (data.type === 'user') return new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(min).setMaxValues(max);
  if (data.type === 'role') return new RoleSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(min).setMaxValues(max);
  if (data.type === 'mentionable') return new MentionableSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(min).setMaxValues(max);
  if (data.type === 'channel') return new ChannelSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(min).setMaxValues(max);

  const options = (data.options?.length ? data.options : [{ label: 'Opção', value: 'opcao' }]).slice(0, 25).map((opt, i) => ({
    label: String(opt.label || `Opção ${i + 1}`).slice(0, 100),
    value: String(opt.value || `option_${i + 1}`).slice(0, 100),
    ...(opt.description ? { description: String(opt.description).slice(0, 100) } : {}),
    ...(opt.emoji ? { emoji: opt.emoji } : {}),
    default: Boolean(opt.default),
  }));
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(Math.min(min, options.length))
    .setMaxValues(Math.min(max, options.length))
    .addOptions(options);
}

function rowsFromInteractive(buttons = [], menus = [], scope = 'pub') {
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder();
    for (let x = i; x < Math.min(i + 5, buttons.length); x++) row.addComponents(buildButton(buttons[x], x, `${scope}btn`));
    rows.push(row);
  }
  for (let i = 0; i < menus.length; i++) rows.push(new ActionRowBuilder().addComponents(buildMenu(menus[i], i, `${scope}sel`)));
  if (rows.length > 5) throw new Error('O Discord permite no máximo 5 Action Rows em mensagens tradicionais.');
  return rows;
}

function buildEmbed(session) {
  const e = session.embed;
  const embed = new EmbedBuilder();
  if (e.title) embed.setTitle(e.title.slice(0, 256));
  if (e.titleUrl) embed.setURL(e.titleUrl);
  if (e.description) embed.setDescription(e.description.slice(0, 4096));
  if (Number.isInteger(e.color)) embed.setColor(e.color);
  if (e.author?.name) embed.setAuthor({
    name: e.author.name.slice(0, 256),
    ...(e.author.url ? { url: e.author.url } : {}),
    ...(e.author.iconURL ? { iconURL: e.author.iconURL } : {}),
  });
  if (e.thumbnail) embed.setThumbnail(e.thumbnail);
  if (e.image) embed.setImage(e.image);
  if (e.fields?.length) embed.addFields(e.fields.slice(0, 25).map(f => ({
    name: String(f.name || 'Campo').slice(0, 256),
    value: String(f.value || '—').slice(0, 1024),
    inline: Boolean(f.inline),
  })));
  if (e.footer?.text) embed.setFooter({ text: e.footer.text.slice(0, 2048), ...(e.footer.iconURL ? { iconURL: e.footer.iconURL } : {}) });
  if (e.timestamp) embed.setTimestamp();
  return embed;
}

function buildV2Block(block, index) {
  if (block.type === 'title') return new TextDisplayBuilder().setContent(`# ${block.text || 'Título'}`.slice(0, 4000));
  if (block.type === 'text') return new TextDisplayBuilder().setContent(String(block.text || 'Texto').slice(0, 4000));
  if (block.type === 'separator') return new SeparatorBuilder().setDivider(block.divider !== false).setSpacing(block.spacing === 'large' ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small);
  if (block.type === 'file') {
    return new FileBuilder().setURL(`attachment://${block.filename}`).setSpoiler(Boolean(block.spoiler));
  }
  if (block.type === 'image' || block.type === 'gallery') {
    const gallery = new MediaGalleryBuilder();
    const items = block.type === 'gallery' ? block.items ?? [] : [{ url: block.url, description: block.description, spoiler: block.spoiler }];
    for (const item of items.slice(0, 10)) {
      gallery.addItems(builder => {
        builder.setURL(item.url);
        if (item.description) builder.setDescription(String(item.description).slice(0, 1024));
        builder.setSpoiler(Boolean(item.spoiler));
        return builder;
      });
    }
    return gallery;
  }
  if (block.type === 'section' || block.type === 'thumbnail') {
    const section = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(String(block.text || 'Seção').slice(0, 4000)),
    );
    if (block.thumbnailUrl) {
      const thumb = new ThumbnailBuilder().setURL(block.thumbnailUrl).setSpoiler(Boolean(block.spoiler));
      if (block.description) thumb.setDescription(String(block.description).slice(0, 1024));
      section.setThumbnailAccessory(thumb);
    } else if (block.button) {
      const b = buildButton(block.button, index, 'pubv2sec');
      section.setButtonAccessory(b);
    } else {
      section.setThumbnailAccessory(new ThumbnailBuilder().setURL('https://cdn.discordapp.com/embed/avatars/0.png').setDescription('Acessório padrão'));
    }
    return section;
  }
  if (block.type === 'container') {
    const container = new ContainerBuilder();
    if (Number.isInteger(block.color)) container.setAccentColor(block.color);
    container.setSpoiler(Boolean(block.spoiler));
    for (const text of (block.texts?.length ? block.texts : [block.text || 'Container']).slice(0, 10)) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(String(text).slice(0, 4000)));
    }
    return container;
  }
  if (block.type === 'buttons') {
    const row = new ActionRowBuilder();
    for (let i = 0; i < Math.min(5, block.items?.length ?? 0); i++) row.addComponents(buildButton(block.items[i], i, 'pubv2'));
    return row;
  }
  if (block.type === 'menu') return new ActionRowBuilder().addComponents(buildMenu(block.menu, index, 'pubv2'));
  throw new Error(`Bloco V2 não suportado: ${block.type}`);
}

function estimateV2Count(components) {
  let total = 0;
  const walk = c => {
    total += 1;
    if (Array.isArray(c.components)) c.components.forEach(walk);
    if (Array.isArray(c.items)) c.items.forEach(() => total += 1);
    if (c.accessory) walk(c.accessory);
  };
  components.forEach(c => walk(c.toJSON ? c.toJSON() : c));
  return total;
}

export async function buildMessagePayload(session) {
  if (session.type === 'normal') {
    if (!session.content && !session.buttons.length && !session.menus.length) throw new Error('A mensagem está vazia.');
    return {
      content: session.content || undefined,
      components: rowsFromInteractive(session.buttons, session.menus, 'pub'),
      allowedMentions: { parse: [] },
    };
  }

  if (session.type === 'embed') {
    const embed = buildEmbed(session);
    const data = embed.toJSON();
    if (!Object.keys(data).length && !session.buttons.length && !session.menus.length) throw new Error('O Embed está vazio.');
    return {
      embeds: Object.keys(data).length ? [embed] : [],
      components: rowsFromInteractive(session.buttons, session.menus, 'pub'),
      allowedMentions: { parse: [] },
    };
  }

  if (session.type === 'v2') {
    if (!session.blocks.length) throw new Error('Adicione ao menos um bloco V2.');
    const components = session.blocks.map(buildV2Block);
    if (estimateV2Count(components) > 40) throw new Error('A estrutura excede o limite de 40 componentes do Components V2.');

    const files = [];
    for (const block of session.blocks.filter(b => b.type === 'file')) {
      const response = await fetch(block.sourceUrl, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`Falha ao baixar arquivo: HTTP ${response.status}.`);
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > 20 * 1024 * 1024) throw new Error(`Arquivo "${block.filename}" excede 20 MB.`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 20 * 1024 * 1024) throw new Error(`Arquivo "${block.filename}" excede 20 MB.`);
      files.push(new AttachmentBuilder(buffer, { name: block.filename }));
    }

    return {
      flags: MessageFlags.IsComponentsV2,
      components,
      ...(files.length ? { files } : {}),
      allowedMentions: { parse: [] },
    };
  }

  throw new Error('Escolha o tipo de mensagem primeiro.');
}

export function summaryText(session) {
  if (session.type === 'normal') return `Mensagem Normal • ${session.content.length} caracteres • ${session.buttons.length} botão(ões) • ${session.menus.length} menu(s)`;
  if (session.type === 'embed') return `Embed Normal • ${session.embed.fields.length} campo(s) • ${session.buttons.length} botão(ões) • ${session.menus.length} menu(s)`;
  if (session.type === 'v2') return `Components V2 • ${session.blocks.length} bloco(s)`;
  return 'Nenhum tipo selecionado';
}
