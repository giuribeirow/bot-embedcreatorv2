import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, EmbedBuilder, MessageFlags, StringSelectMenuBuilder,
} from 'discord.js';
import { buildMessagePayload } from '../builder/render.js';
import { getSession, pushHistory, resetSession, undo } from '../builder/sessions.js';
import { builderChooserPayload, editorPayload, labelBlock } from '../panel/builderPanel.js';
import { makeModal } from '../utils/modal.js';
import { isHttpUrl, parseHex, validCustomId } from '../utils/validation.js';

function sessionFor(i) { return getSession(i.user.id, i.guildId); }

async function refreshEditor(i, s, message = null) {
  const payload = editorPayload(s);
  if (i.isModalSubmit()) {
    try {
      if (i.isFromMessage?.()) await i.update(payload);
      else await i.reply({ content: message ?? '✅ Alteração salva.', flags: MessageFlags.Ephemeral });
    } catch {
      if (!i.replied && !i.deferred) await i.reply({ content: message ?? '✅ Alteração salva.', flags: MessageFlags.Ephemeral });
    }
  } else {
    await i.update(payload);
  }
  await syncPreview(i, s).catch(() => {});
}

function previewFlags(payload) {
  const base = Number(payload.flags ?? 0);
  return base | MessageFlags.Ephemeral;
}

async function syncPreview(i, s, forceNew = false) {
  let payload;
  try { payload = await buildMessagePayload(s); }
  catch (error) {
    const fallback = { content: `👁️ Preview indisponível: ${error.message}`, flags: MessageFlags.Ephemeral };
    if (!i.replied && !i.deferred) return i.reply(fallback);
    return i.followUp(fallback);
  }
  payload = { ...payload, flags: previewFlags(payload) };
  delete payload.ephemeral;

  if (!forceNew && s.preview?.id && s.preview?.webhook && s.preview.type === s.type) {
    try {
      await s.preview.webhook.editMessage(s.preview.id, payload);
      return;
    } catch {}
  }

  const msg = await i.followUp({ ...payload, fetchReply: true });
  s.preview = { id: msg.id, webhook: i.webhook, type: s.type, createdAt: Date.now() };
}

function buttonModal(customId, title, current = {}) {
  return makeModal(customId, title, [
    { id: 'label', label: 'Texto / label', value: current.label ?? '', maxLength: 80 },
    { id: 'style', label: 'Estilo', value: current.style ?? 'secondary', placeholder: 'primary/secondary/success/danger/link', maxLength: 20 },
    { id: 'target', label: 'Custom ID ou URL', value: current.style === 'link' ? current.url ?? '' : current.customId ?? '', maxLength: 1000 },
    { id: 'emoji', label: 'Emoji (opcional)', value: current.emoji ?? '', required: false, maxLength: 100 },
    { id: 'disabled', label: 'Desativado? true/false', value: String(Boolean(current.disabled)), maxLength: 5 },
  ]);
}

function readButton(i) {
  const label = i.fields.getTextInputValue('label').trim();
  const style = i.fields.getTextInputValue('style').trim().toLowerCase();
  const target = i.fields.getTextInputValue('target').trim();
  const emoji = i.fields.getTextInputValue('emoji').trim();
  const disabled = i.fields.getTextInputValue('disabled').trim().toLowerCase() === 'true';
  if (!label) throw new Error('Label obrigatório.');
  if (!['primary','secondary','success','danger','link'].includes(style)) throw new Error('Estilo inválido.');
  if (style === 'link' && !isHttpUrl(target)) throw new Error('Botão Link exige URL http(s).');
  if (style !== 'link' && !validCustomId(target)) throw new Error('Custom ID deve ter 1 a 100 caracteres.');
  return { label, style, ...(style === 'link' ? { url: target } : { customId: target }), ...(emoji ? { emoji } : {}), disabled };
}

function menuModal(customId, title, current = {}) {
  const optionsText = (current.options ?? []).map(o => [o.label,o.value,o.description ?? '',o.emoji ?? '',o.default ? 'true':'false'].join('|')).join('\n');
  return makeModal(customId, title, [
    { id: 'type', label: 'Tipo', value: current.type ?? 'string', placeholder: 'string/user/role/mentionable/channel', maxLength: 20 },
    { id: 'placeholder', label: 'Placeholder', value: current.placeholder ?? 'Selecione uma opção', maxLength: 150 },
    { id: 'custom', label: 'Custom ID', value: current.customId ?? '', maxLength: 100 },
    { id: 'limits', label: 'Mínimo,máximo', value: `${current.min ?? 1},${current.max ?? 1}`, maxLength: 10 },
    { id: 'options', label: 'Opções string: label|value|desc|emoji|default', value: optionsText, required: false, style: 'paragraph', maxLength: 4000 },
  ]);
}

function readMenu(i) {
  const type = i.fields.getTextInputValue('type').trim().toLowerCase();
  const placeholder = i.fields.getTextInputValue('placeholder').trim();
  const customId = i.fields.getTextInputValue('custom').trim();
  const [minRaw, maxRaw] = i.fields.getTextInputValue('limits').split(',');
  const min = Number(minRaw); const max = Number(maxRaw);
  if (!['string','user','role','mentionable','channel'].includes(type)) throw new Error('Tipo de menu inválido.');
  if (!validCustomId(customId)) throw new Error('Custom ID inválido.');
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1 || min > max || max > 25) throw new Error('Limites inválidos.');
  const options = [];
  if (type === 'string') {
    const lines = i.fields.getTextInputValue('options').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    for (const line of lines.slice(0,25)) {
      const [label, value, description, emoji, def] = line.split('|');
      if (!label || !value) throw new Error('Cada opção precisa de label e value.');
      options.push({ label, value, ...(description ? { description } : {}), ...(emoji ? { emoji } : {}), default: def?.toLowerCase() === 'true' });
    }
    if (!options.length) options.push({ label: 'Opção', value: 'opcao', default: false });
  }
  return { type, placeholder, customId, min, max, options };
}

function parseGallery(text) {
  const items = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0,10).map(line => {
    const [url, description, spoiler] = line.split('|');
    if (!isHttpUrl(url)) throw new Error(`URL inválida na galeria: ${url}`);
    return { url, ...(description ? { description } : {}), spoiler: spoiler?.toLowerCase() === 'true' };
  });
  if (!items.length) throw new Error('Adicione ao menos uma mídia.');
  return items;
}

function selectStructurePayload(s) {
  let options = [];
  if (s.type === 'v2') options = s.blocks.map((b,i) => ({ label: `${i+1}. ${labelBlock(b.type)}`.slice(0,100), value: `block:${i}` }));
  else {
    if (s.type === 'embed') s.embed.fields.forEach((f,i) => options.push({ label: `Campo ${i+1}: ${f.name}`.slice(0,100), value: `field:${i}` }));
    s.buttons.forEach((b,i) => options.push({ label: `Botão ${i+1}: ${b.label}`.slice(0,100), value: `button:${i}` }));
    s.menus.forEach((m,i) => options.push({ label: `Menu ${i+1}: ${m.placeholder}`.slice(0,100), value: `menu:${i}` }));
  }
  if (!options.length) return { content: '📚 Não há itens selecionáveis na estrutura.', flags: MessageFlags.Ephemeral };
  const select = new StringSelectMenuBuilder().setCustomId('builder:structure:select').setPlaceholder('Escolha um elemento').addOptions(options.slice(0,25));
  return { content: '📚 Selecione um elemento para editar/mover/excluir:', components: [new ActionRowBuilder().addComponents(select)], flags: MessageFlags.Ephemeral };
}

function selectedControlsPayload(s, value) {
  s.selectedItem = value;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('builder:selected:edit').setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('builder:selected:up').setLabel('Subir').setEmoji('⬆️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('builder:selected:down').setLabel('Descer').setEmoji('⬇️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('builder:selected:duplicate').setLabel('Duplicar').setEmoji('📄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('builder:selected:delete').setLabel('Excluir').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  );
  return { content: `Selecionado: **${value}**`, components: [row], flags: MessageFlags.Ephemeral };
}

function removeLastTraditional(s) {
  if (s.menus.length) { s.menus.pop(); return 'menu'; }
  if (s.buttons.length) { s.buttons.pop(); return 'botão'; }
  if (s.type === 'normal' && s.content) { s.content = ''; return 'conteúdo'; }
  if (s.type === 'embed') {
    if (s.embed.fields.length) { s.embed.fields.pop(); return 'campo'; }
    for (const key of ['timestamp','footer','image','thumbnail','author','color','description','title']) {
      if (s.embed[key]) { s.embed[key] = ['timestamp'].includes(key) ? false : (key === 'color' ? null : (['author','footer'].includes(key) ? null : '')); return key; }
    }
  }
  return null;
}

export async function handleBuilderInteraction(i) {
  const id = i.customId;
  const s = sessionFor(i);

  if (id === 'panel:builder') return i.update(builderChooserPayload());
  if (id.startsWith('builder:type:')) {
    const type = id.split(':').pop();
    pushHistory(s); s.type = type; s.preview = null;
    await i.update(editorPayload(s));
    return syncPreview(i, s, true);
  }

  if (id === 'builder:add') {
    const item = i.values[0];
    if (s.type === 'normal') {
      if (item === 'content') return i.showModal(makeModal('modal:builder:normal:content', 'Conteúdo da mensagem', [{ id: 'content', label: 'Conteúdo', value: s.content, style: 'paragraph', required: false, maxLength: 2000 }]));
      if (item === 'button') return i.showModal(buttonModal('modal:builder:add:button', 'Adicionar botão'));
      if (item === 'menu') return i.showModal(menuModal('modal:builder:add:menu', 'Adicionar menu'));
    }
    if (s.type === 'embed') {
      if (item === 'title') return i.showModal(makeModal('modal:builder:embed:title','Título do Embed',[{id:'title',label:'Título',value:s.embed.title,required:false,maxLength:256},{id:'url',label:'URL do título (opcional)',value:s.embed.titleUrl,required:false,maxLength:1000}]));
      if (item === 'description') return i.showModal(makeModal('modal:builder:embed:description','Descrição do Embed',[{id:'text',label:'Descrição',value:s.embed.description,required:false,style:'paragraph',maxLength:4000}]));
      if (item === 'color') return i.showModal(makeModal('modal:builder:embed:color','Cor do Embed',[{id:'hex',label:'HEX (vazio remove)',value:Number.isInteger(s.embed.color) ? `#${s.embed.color.toString(16).padStart(6,'0')}` : '',required:false,maxLength:7}]));
      if (item === 'author') return i.showModal(makeModal('modal:builder:embed:author','Autor',[{id:'name',label:'Nome',value:s.embed.author?.name ?? '',required:false,maxLength:256},{id:'url',label:'URL (opcional)',value:s.embed.author?.url ?? '',required:false,maxLength:1000},{id:'icon',label:'Ícone URL (opcional)',value:s.embed.author?.iconURL ?? '',required:false,maxLength:1000}]));
      if (item === 'thumbnail') return i.showModal(makeModal('modal:builder:embed:thumbnail','Thumbnail',[{id:'url',label:'URL (vazio remove)',value:s.embed.thumbnail,required:false,maxLength:1000}]));
      if (item === 'image') return i.showModal(makeModal('modal:builder:embed:image','Imagem',[{id:'url',label:'URL (vazio remove)',value:s.embed.image,required:false,maxLength:1000}]));
      if (item === 'field') return i.showModal(makeModal('modal:builder:embed:field:add','Adicionar campo',[{id:'name',label:'Nome',maxLength:256},{id:'value',label:'Valor',style:'paragraph',maxLength:1024},{id:'inline',label:'Inline? true/false',value:'false',maxLength:5}]));
      if (item === 'footer') return i.showModal(makeModal('modal:builder:embed:footer','Rodapé',[{id:'text',label:'Texto (vazio remove)',value:s.embed.footer?.text ?? '',required:false,maxLength:2048},{id:'icon',label:'Ícone URL (opcional)',value:s.embed.footer?.iconURL ?? '',required:false,maxLength:1000}]));
      if (item === 'timestamp') { pushHistory(s); s.embed.timestamp = !s.embed.timestamp; return refreshEditor(i,s); }
      if (item === 'button') return i.showModal(buttonModal('modal:builder:add:button','Adicionar botão'));
      if (item === 'menu') return i.showModal(menuModal('modal:builder:add:menu','Adicionar menu'));
    }
    if (s.type === 'v2') {
      if (item === 'title') return i.showModal(makeModal('modal:builder:v2:title','Adicionar título',[{id:'text',label:'Título',maxLength:3000}]));
      if (item === 'text') return i.showModal(makeModal('modal:builder:v2:text','Adicionar texto',[{id:'text',label:'Texto Markdown',style:'paragraph',maxLength:4000}]));
      if (item === 'separator') { pushHistory(s); s.blocks.push({type:'separator',divider:true,spacing:'small'}); return refreshEditor(i,s); }
      if (item === 'image') return i.showModal(makeModal('modal:builder:v2:image','Adicionar imagem',[{id:'url',label:'URL',maxLength:1000},{id:'description',label:'Descrição/alt (opcional)',required:false,maxLength:1024},{id:'spoiler',label:'Spoiler? true/false',value:'false',maxLength:5}]));
      if (item === 'gallery') return i.showModal(makeModal('modal:builder:v2:gallery','Media Gallery',[{id:'items',label:'URL|descrição|spoiler, uma por linha',style:'paragraph',maxLength:4000}]));
      if (item === 'section' || item === 'thumbnail') return i.showModal(makeModal(`modal:builder:v2:${item}`,'Section / Thumbnail',[{id:'text',label:'Texto da Section',value:item==='thumbnail'?'Imagem em destaque':'Texto da seção',maxLength:4000},{id:'url',label:'URL da Thumbnail',maxLength:1000},{id:'description',label:'Descrição/alt (opcional)',required:false,maxLength:1024},{id:'spoiler',label:'Spoiler? true/false',value:'false',maxLength:5}]));
      if (item === 'container') return i.showModal(makeModal('modal:builder:v2:container','Container',[{id:'text',label:'Texto Markdown',style:'paragraph',maxLength:4000},{id:'hex',label:'Accent HEX (opcional)',required:false,maxLength:7},{id:'spoiler',label:'Spoiler? true/false',value:'false',maxLength:5}]));
      if (item === 'file') return i.showModal(makeModal('modal:builder:v2:file','Adicionar File',[{id:'url',label:'URL direta do arquivo',maxLength:1000},{id:'filename',label:'Nome do arquivo (com extensão)',placeholder:'arquivo.pdf',maxLength:100},{id:'spoiler',label:'Spoiler? true/false',value:'false',maxLength:5}]));
      if (item === 'buttons') return i.showModal(buttonModal('modal:builder:v2:buttons','Adicionar botão V2'));
      if (item === 'menu') return i.showModal(menuModal('modal:builder:v2:menu','Adicionar Select V2'));
    }
  }

  if (id === 'modal:builder:normal:content') { pushHistory(s); s.content = i.fields.getTextInputValue('content'); return refreshEditor(i,s); }
  if (id === 'modal:builder:add:button') {
    try { const b=readButton(i); pushHistory(s); s.buttons.push(b); return refreshEditor(i,s); } catch(e){ return i.reply({content:`❌ ${e.message}`,flags:MessageFlags.Ephemeral}); }
  }
  if (id === 'modal:builder:add:menu') {
    try { const m=readMenu(i); pushHistory(s); s.menus.push(m); return refreshEditor(i,s); } catch(e){ return i.reply({content:`❌ ${e.message}`,flags:MessageFlags.Ephemeral}); }
  }

  if (id === 'modal:builder:embed:title') { pushHistory(s); s.embed.title=i.fields.getTextInputValue('title').trim(); s.embed.titleUrl=i.fields.getTextInputValue('url').trim(); if(s.embed.titleUrl&&!isHttpUrl(s.embed.titleUrl)) return i.reply({content:'❌ URL inválida.',flags:MessageFlags.Ephemeral}); return refreshEditor(i,s); }
  if (id === 'modal:builder:embed:description') { pushHistory(s); s.embed.description=i.fields.getTextInputValue('text'); return refreshEditor(i,s); }
  if (id === 'modal:builder:embed:color') { const raw=i.fields.getTextInputValue('hex').trim(); const color=raw?parseHex(raw):null; if(raw&&color===null)return i.reply({content:'❌ HEX inválido.',flags:MessageFlags.Ephemeral}); pushHistory(s); s.embed.color=color; return refreshEditor(i,s); }
  if (id === 'modal:builder:embed:author') { const name=i.fields.getTextInputValue('name').trim(),url=i.fields.getTextInputValue('url').trim(),icon=i.fields.getTextInputValue('icon').trim(); if(url&&!isHttpUrl(url)||icon&&!isHttpUrl(icon))return i.reply({content:'❌ URL inválida.',flags:MessageFlags.Ephemeral}); pushHistory(s); s.embed.author=name?{name,...(url?{url}:{}),...(icon?{iconURL:icon}:{})}:null; return refreshEditor(i,s); }
  if (id === 'modal:builder:embed:thumbnail' || id === 'modal:builder:embed:image') { const url=i.fields.getTextInputValue('url').trim(); if(url&&!isHttpUrl(url))return i.reply({content:'❌ URL inválida.',flags:MessageFlags.Ephemeral}); pushHistory(s); s.embed[id.endsWith('thumbnail')?'thumbnail':'image']=url; return refreshEditor(i,s); }
  if (id === 'modal:builder:embed:field:add') { if(s.embed.fields.length>=25)return i.reply({content:'❌ Limite de 25 fields atingido.',flags:MessageFlags.Ephemeral}); pushHistory(s); s.embed.fields.push({name:i.fields.getTextInputValue('name'),value:i.fields.getTextInputValue('value'),inline:i.fields.getTextInputValue('inline').trim().toLowerCase()==='true'}); return refreshEditor(i,s); }
  if (id === 'modal:builder:embed:footer') { const text=i.fields.getTextInputValue('text').trim(),icon=i.fields.getTextInputValue('icon').trim(); if(icon&&!isHttpUrl(icon))return i.reply({content:'❌ URL inválida.',flags:MessageFlags.Ephemeral}); pushHistory(s); s.embed.footer=text?{text,...(icon?{iconURL:icon}:{})}:null; return refreshEditor(i,s); }

  if (id === 'modal:builder:v2:title' || id === 'modal:builder:v2:text') { pushHistory(s); s.blocks.push({type:id.endsWith('title')?'title':'text',text:i.fields.getTextInputValue('text')}); return refreshEditor(i,s); }
  if (id === 'modal:builder:v2:image') { const url=i.fields.getTextInputValue('url').trim(); if(!isHttpUrl(url))return i.reply({content:'❌ URL inválida.',flags:MessageFlags.Ephemeral}); pushHistory(s); s.blocks.push({type:'image',url,description:i.fields.getTextInputValue('description').trim(),spoiler:i.fields.getTextInputValue('spoiler').trim().toLowerCase()==='true'}); return refreshEditor(i,s); }
  if (id === 'modal:builder:v2:gallery') { try{const items=parseGallery(i.fields.getTextInputValue('items'));pushHistory(s);s.blocks.push({type:'gallery',items});return refreshEditor(i,s);}catch(e){return i.reply({content:`❌ ${e.message}`,flags:MessageFlags.Ephemeral});} }
  if (id === 'modal:builder:v2:section' || id === 'modal:builder:v2:thumbnail') { const url=i.fields.getTextInputValue('url').trim();if(!isHttpUrl(url))return i.reply({content:'❌ URL inválida.',flags:MessageFlags.Ephemeral});pushHistory(s);s.blocks.push({type:id.endsWith('thumbnail')?'thumbnail':'section',text:i.fields.getTextInputValue('text'),thumbnailUrl:url,description:i.fields.getTextInputValue('description').trim(),spoiler:i.fields.getTextInputValue('spoiler').trim().toLowerCase()==='true'});return refreshEditor(i,s); }
  if (id === 'modal:builder:v2:container') { const raw=i.fields.getTextInputValue('hex').trim();const color=raw?parseHex(raw):null;if(raw&&color===null)return i.reply({content:'❌ HEX inválido.',flags:MessageFlags.Ephemeral});pushHistory(s);s.blocks.push({type:'container',text:i.fields.getTextInputValue('text'),color,spoiler:i.fields.getTextInputValue('spoiler').trim().toLowerCase()==='true'});return refreshEditor(i,s); }
  if (id === 'modal:builder:v2:file') { const url=i.fields.getTextInputValue('url').trim();const filename=i.fields.getTextInputValue('filename').trim().replace(/[\\/:*?"<>|]/g,'_');if(!isHttpUrl(url))return i.reply({content:'❌ URL inválida.',flags:MessageFlags.Ephemeral});if(!filename)return i.reply({content:'❌ Nome do arquivo obrigatório.',flags:MessageFlags.Ephemeral});pushHistory(s);s.blocks.push({type:'file',sourceUrl:url,filename,spoiler:i.fields.getTextInputValue('spoiler').trim().toLowerCase()==='true'});return refreshEditor(i,s); }
  if (id === 'modal:builder:v2:buttons') { try{const b=readButton(i);pushHistory(s);const last=s.blocks.at(-1);if(last?.type==='buttons'&&last.items.length<5)last.items.push(b);else s.blocks.push({type:'buttons',items:[b]});return refreshEditor(i,s);}catch(e){return i.reply({content:`❌ ${e.message}`,flags:MessageFlags.Ephemeral});} }
  if (id === 'modal:builder:v2:menu') { try{const m=readMenu(i);pushHistory(s);s.blocks.push({type:'menu',menu:m});return refreshEditor(i,s);}catch(e){return i.reply({content:`❌ ${e.message}`,flags:MessageFlags.Ephemeral});} }

  if (id === 'builder:undo') { if(!undo(s))return i.reply({content:'↩️ Não há alteração recente para desfazer.',flags:MessageFlags.Ephemeral}); return refreshEditor(i,s); }
  if (id === 'builder:remove') { pushHistory(s); const removed=s.type==='v2'?s.blocks.pop():removeLastTraditional(s); if(!removed){s.history.pop();return i.reply({content:'❌ Não há nada para remover.',flags:MessageFlags.Ephemeral});} return refreshEditor(i,s); }
  if (id === 'builder:structure') return i.reply(selectStructurePayload(s));
  if (id === 'builder:structure:select') return i.update(selectedControlsPayload(s,i.values[0]));

  if (id.startsWith('builder:selected:')) {
    if (!s.selectedItem) return i.reply({content:'❌ Selecione um item primeiro.',flags:MessageFlags.Ephemeral});
    const [kind,indexRaw]=s.selectedItem.split(':'); const index=Number(indexRaw);
    const action=id.split(':').pop();
    let arr = kind==='block'?s.blocks:kind==='field'?s.embed.fields:kind==='button'?s.buttons:s.menus;
    if(!arr?.[index])return i.reply({content:'❌ Item não existe mais.',flags:MessageFlags.Ephemeral});
    if(action==='delete'){pushHistory(s);arr.splice(index,1);s.selectedItem=null;await i.update({content:'✅ Item excluído.',components:[]});return syncPreview(i,s);}
    if(action==='duplicate'){pushHistory(s);arr.splice(index+1,0,structuredClone(arr[index]));s.selectedItem=`${kind}:${index+1}`;await i.update({content:'✅ Item duplicado.',components:[]});return syncPreview(i,s);}
    if(action==='up'||action==='down'){const to=action==='up'?index-1:index+1;if(to<0||to>=arr.length)return i.reply({content:'❌ Não é possível mover nessa direção.',flags:MessageFlags.Ephemeral});pushHistory(s);[arr[index],arr[to]]=[arr[to],arr[index]];s.selectedItem=`${kind}:${to}`;await i.update({content:'✅ Ordem atualizada.',components:[]});return syncPreview(i,s);}
    if(action==='edit'){
      const item=arr[index];
      if(kind==='button')return i.showModal(buttonModal(`modal:builder:edit:button:${index}`,'Editar botão',item));
      if(kind==='menu')return i.showModal(menuModal(`modal:builder:edit:menu:${index}`,'Editar menu',item));
      if(kind==='field')return i.showModal(makeModal(`modal:builder:edit:field:${index}`,'Editar campo',[{id:'name',label:'Nome',value:item.name,maxLength:256},{id:'value',label:'Valor',value:item.value,style:'paragraph',maxLength:1024},{id:'inline',label:'Inline? true/false',value:String(Boolean(item.inline)),maxLength:5}]));
      if(kind==='block'){
        if(item.type==='title'||item.type==='text')return i.showModal(makeModal(`modal:builder:edit:block:${index}:text`,'Editar bloco',[{id:'text',label:'Texto',value:item.text,style:item.type==='text'?'paragraph':'short',maxLength:4000}]));
        if(item.type==='separator'){pushHistory(s);item.spacing=item.spacing==='small'?'large':'small';item.divider=!item.divider;await i.update({content:'✅ Separador alternado (spacing/divider).',components:[]});return syncPreview(i,s);}
        if(item.type==='container')return i.showModal(makeModal(`modal:builder:edit:block:${index}:container`,'Editar Container',[{id:'text',label:'Texto',value:item.text,style:'paragraph',maxLength:4000},{id:'hex',label:'Accent HEX',value:Number.isInteger(item.color)?`#${item.color.toString(16).padStart(6,'0')}`:'',required:false,maxLength:7},{id:'spoiler',label:'Spoiler? true/false',value:String(Boolean(item.spoiler)),maxLength:5}]));
        if(item.type==='file')return i.showModal(makeModal(`modal:builder:edit:block:${index}:file`,'Editar File',[{id:'url',label:'URL direta do arquivo',value:item.sourceUrl,maxLength:1000},{id:'filename',label:'Nome do arquivo',value:item.filename,maxLength:100},{id:'spoiler',label:'Spoiler? true/false',value:String(Boolean(item.spoiler)),maxLength:5}]));
        if(item.type==='image'||item.type==='section'||item.type==='thumbnail')return i.showModal(makeModal(`modal:builder:edit:block:${index}:media`,'Editar mídia',[{id:'url',label:'URL',value:item.url??item.thumbnailUrl,maxLength:1000},{id:'description',label:'Descrição',value:item.description??'',required:false,maxLength:1024},{id:'text',label:'Texto Section (se aplicável)',value:item.text??'',required:false,style:'paragraph',maxLength:4000},{id:'spoiler',label:'Spoiler? true/false',value:String(Boolean(item.spoiler)),maxLength:5}]));
        if(item.type==='buttons')return i.showModal(buttonModal(`modal:builder:edit:blockbutton:${index}`,'Editar primeiro botão',item.items[0]));
        if(item.type==='menu')return i.showModal(menuModal(`modal:builder:edit:blockmenu:${index}`,'Editar Select V2',item.menu));
        if(item.type==='gallery')return i.showModal(makeModal(`modal:builder:edit:block:${index}:gallery`,'Editar galeria',[{id:'items',label:'URL|descrição|spoiler, uma por linha',value:item.items.map(x=>[x.url,x.description??'',x.spoiler?'true':'false'].join('|')).join('\n'),style:'paragraph',maxLength:4000}]));
      }
    }
  }

  if (id.startsWith('modal:builder:edit:button:')) { const idx=Number(id.split(':').pop());try{const val=readButton(i);pushHistory(s);s.buttons[idx]=val;return refreshEditor(i,s);}catch(e){return i.reply({content:`❌ ${e.message}`,flags:MessageFlags.Ephemeral});} }
  if (id.startsWith('modal:builder:edit:menu:')) { const idx=Number(id.split(':').pop());try{const val=readMenu(i);pushHistory(s);s.menus[idx]=val;return refreshEditor(i,s);}catch(e){return i.reply({content:`❌ ${e.message}`,flags:MessageFlags.Ephemeral});} }
  if (id.startsWith('modal:builder:edit:field:')) { const idx=Number(id.split(':').pop());pushHistory(s);s.embed.fields[idx]={name:i.fields.getTextInputValue('name'),value:i.fields.getTextInputValue('value'),inline:i.fields.getTextInputValue('inline').trim().toLowerCase()==='true'};return refreshEditor(i,s); }
  if (id.startsWith('modal:builder:edit:blockbutton:')) { const idx=Number(id.split(':').pop());try{const val=readButton(i);pushHistory(s);s.blocks[idx].items[0]=val;return refreshEditor(i,s);}catch(e){return i.reply({content:`❌ ${e.message}`,flags:MessageFlags.Ephemeral});} }
  if (id.startsWith('modal:builder:edit:blockmenu:')) { const idx=Number(id.split(':').pop());try{const val=readMenu(i);pushHistory(s);s.blocks[idx].menu=val;return refreshEditor(i,s);}catch(e){return i.reply({content:`❌ ${e.message}`,flags:MessageFlags.Ephemeral});} }
  if (id.startsWith('modal:builder:edit:block:')) {
    const parts=id.split(':');const idx=Number(parts[4]);const mode=parts[5];const b=s.blocks[idx];if(!b)return i.reply({content:'❌ Bloco não existe.',flags:MessageFlags.Ephemeral});
    try{
      pushHistory(s);
      if(mode==='text')b.text=i.fields.getTextInputValue('text');
      if(mode==='container'){const raw=i.fields.getTextInputValue('hex').trim();const color=raw?parseHex(raw):null;if(raw&&color===null)throw new Error('HEX inválido.');b.text=i.fields.getTextInputValue('text');b.color=color;b.spoiler=i.fields.getTextInputValue('spoiler').trim().toLowerCase()==='true';}
      if(mode==='media'){const url=i.fields.getTextInputValue('url').trim();if(!isHttpUrl(url))throw new Error('URL inválida.');if(b.type==='image')b.url=url;else b.thumbnailUrl=url;b.description=i.fields.getTextInputValue('description').trim();b.text=i.fields.getTextInputValue('text').trim()||b.text;b.spoiler=i.fields.getTextInputValue('spoiler').trim().toLowerCase()==='true';}
      if(mode==='gallery')b.items=parseGallery(i.fields.getTextInputValue('items'));
      if(mode==='file'){const url=i.fields.getTextInputValue('url').trim();const filename=i.fields.getTextInputValue('filename').trim().replace(/[\\/:*?"<>|]/g,'_');if(!isHttpUrl(url))throw new Error('URL inválida.');if(!filename)throw new Error('Nome do arquivo obrigatório.');b.sourceUrl=url;b.filename=filename;b.spoiler=i.fields.getTextInputValue('spoiler').trim().toLowerCase()==='true';}
      return refreshEditor(i,s);
    }catch(e){s.history.pop();return i.reply({content:`❌ ${e.message}`,flags:MessageFlags.Ephemeral});}
  }

  if (id === 'builder:preview') { await i.deferUpdate(); return syncPreview(i,s,true); }
  if (id === 'builder:clear') {
    const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('builder:clear:yes').setLabel('Confirmar').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId('builder:clear:no').setLabel('Cancelar').setStyle(ButtonStyle.Secondary));
    return i.reply({content:'Tem certeza que deseja apagar todo o conteúdo atual?',components:[row],flags:MessageFlags.Ephemeral});
  }
  if (id === 'builder:clear:no') return i.update({content:'Cancelado.',components:[]});
  if (id === 'builder:clear:yes') { pushHistory(s); resetSession(s,true); await i.update({content:'✅ Projeto limpo.',components:[]}); return syncPreview(i,s,true).catch(()=>{}); }

  if (id === 'builder:send') {
    try { await buildMessagePayload(s); } catch(e){ return i.reply({content:`❌ Não foi possível enviar: ${e.message}`,flags:MessageFlags.Ephemeral}); }
    const select=new ChannelSelectMenuBuilder().setCustomId('builder:send:channel').setPlaceholder('Escolha o canal').setMinValues(1).setMaxValues(1);
    return i.reply({content:'📤 Escolha o canal de destino:',components:[new ActionRowBuilder().addComponents(select)],flags:MessageFlags.Ephemeral});
  }
  if (id === 'builder:send:channel') {
    s.channelId=i.values[0];
    const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('builder:send:confirm').setLabel('Enviar').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('builder:send:cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary));
    return i.update({content:`Mensagem pronta para ser enviada em <#${s.channelId}>.`,components:[row]});
  }
  if (id === 'builder:send:cancel') return i.update({content:'Envio cancelado.',components:[]});
  if (id === 'builder:send:confirm') {
    try {
      const channel=await i.client.channels.fetch(s.channelId);
      if(!channel?.isTextBased()||!channel.isSendable())throw new Error('Canal não permite envio pelo bot.');
      const payload=await buildMessagePayload(s);
      await channel.send(payload);
      return i.update({content:'✅ Mensagem enviada com sucesso.',components:[]});
    }catch(e){return i.update({content:`❌ Não foi possível enviar: ${e.message}`,components:[]});}
  }

  return false;
}
