import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { store } from '../config/store.js';
import { makeModal } from '../utils/modal.js';
import { fetchImageBuffer, isHttpUrl, validSnowflake } from '../utils/validation.js';
import { refreshPresence, startRotation } from '../presence/rotation.js';
import { profileView, statusView, presenceView, rotationView, permissionsView } from '../panel/configViews.js';
import { configPanelPayload } from '../panel/mainPanel.js';

const TYPES = new Set(['playing','streaming','listening','watching','competing']);

async function safeUpdate(i, payload) {
  if (i.isModalSubmit()) return i.reply({ ...payload, ephemeral: true });
  return i.update(payload);
}

function parsePresenceFields(i) {
  const type = i.fields.getTextInputValue('type').trim().toLowerCase();
  const name = i.fields.getTextInputValue('name').trim();
  const url = i.fields.getTextInputValue('url').trim();
  if (!TYPES.has(type)) throw new Error('Tipo inválido. Use: playing, streaming, listening, watching ou competing.');
  if (!name) throw new Error('O texto da atividade é obrigatório.');
  if (type === 'streaming' && url && !isHttpUrl(url)) throw new Error('A URL do streaming é inválida.');
  return { type, name: name.slice(0, 128), ...(type === 'streaming' && url ? { url } : {}) };
}

async function collectImage(interaction, target) {
  await interaction.reply({ content: `📎 Envie **uma imagem** neste canal para usar como ${target}. Você tem 60 segundos.`, ephemeral: true });
  try {
    const collected = await interaction.channel.awaitMessages({
      filter: m => m.author.id === interaction.user.id && m.attachments.some(a => a.contentType?.startsWith('image/')),
      max: 1,
      time: 60_000,
      errors: ['time'],
    });
    const message = collected.first();
    const attachment = message.attachments.find(a => a.contentType?.startsWith('image/'));
    const buffer = await fetchImageBuffer(attachment.url);
    if (target === 'avatar') await interaction.client.user.setAvatar(buffer);
    else await interaction.client.user.setBanner(buffer);
    await interaction.followUp({ content: `✅ ${target === 'avatar' ? 'Avatar' : 'Banner'} alterado com sucesso.`, ephemeral: true });
    try { await message.delete(); } catch {}
  } catch (error) {
    await interaction.followUp({ content: `❌ Não foi possível alterar: ${error.message ?? 'tempo esgotado'}`, ephemeral: true });
  }
}

function activityPicker(customId, label) {
  const options = store.data.rotation.activities.map((a, idx) => ({
    label: `${idx + 1}. ${a.name}`.slice(0,100), value: String(idx), description: a.type.slice(0,100),
  }));
  const select = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(label).addOptions(options.slice(0,25));
  return { content: 'Selecione uma atividade:', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true };
}

export async function handleConfigInteraction(i) {
  const id = i.customId;

  if (id === 'panel:config') return i.update(configPanelPayload(i.client));
  if (id === 'config:profile') { await i.client.user.fetch(true).catch(()=>{}); return i.update(profileView(i.client)); }
  if (id === 'config:status') return i.update(statusView());
  if (id === 'config:presence') return i.update(presenceView());
  if (id === 'config:rotation') return i.update(rotationView());
  if (id === 'config:permissions') return i.update(permissionsView());

  if (id === 'profile:avatar:url' || id === 'profile:banner:url') {
    const target = id.includes('avatar') ? 'avatar' : 'banner';
    return i.showModal(makeModal(`modal:profile:${target}`, `Alterar ${target}`, [{ id: 'url', label: 'URL da imagem', placeholder: 'https://...', maxLength: 1000 }]));
  }
  if (id === 'profile:avatar:file') return collectImage(i, 'avatar');
  if (id === 'profile:banner:file') return collectImage(i, 'banner');

  if (id === 'modal:profile:avatar' || id === 'modal:profile:banner') {
    const target = id.endsWith('avatar') ? 'avatar' : 'banner';
    try {
      const buffer = await fetchImageBuffer(i.fields.getTextInputValue('url').trim());
      if (target === 'avatar') await i.client.user.setAvatar(buffer);
      else await i.client.user.setBanner(buffer);
      return i.reply({ content: `✅ ${target === 'avatar' ? 'Avatar' : 'Banner'} alterado com sucesso.`, ephemeral: true });
    } catch (error) { return i.reply({ content: `❌ ${error.message}`, ephemeral: true }); }
  }

  if (id === 'status:set') {
    store.data.status = i.values[0]; store.save(); refreshPresence(i.client);
    return i.update(statusView());
  }

  if (id === 'presence:edit') {
    const p = store.data.presence;
    return i.showModal(makeModal('modal:presence', 'Editar presença', [
      { id: 'type', label: 'Tipo', value: p?.type ?? 'playing', placeholder: 'playing/watching/listening/competing/streaming', maxLength: 20 },
      { id: 'name', label: 'Texto', value: p?.name ?? '', maxLength: 128 },
      { id: 'url', label: 'URL streaming (opcional)', value: p?.url ?? '', required: false, maxLength: 1000 },
    ]));
  }
  if (id === 'modal:presence') {
    try { store.data.presence = parsePresenceFields(i); store.save(); refreshPresence(i.client); return i.reply({ content: '✅ Presença salva.', ephemeral: true }); }
    catch (e) { return i.reply({ content: `❌ ${e.message}`, ephemeral: true }); }
  }
  if (id === 'presence:remove') {
    store.data.presence = null; store.save(); refreshPresence(i.client); return i.update(presenceView());
  }

  if (id === 'rotation:add') {
    return i.showModal(makeModal('modal:rotation:add', 'Adicionar atividade', [
      { id: 'type', label: 'Tipo', value: 'playing', placeholder: 'playing/watching/listening/competing/streaming', maxLength: 20 },
      { id: 'name', label: 'Texto', maxLength: 128 },
      { id: 'url', label: 'URL streaming (opcional)', required: false, maxLength: 1000 },
    ]));
  }
  if (id === 'modal:rotation:add') {
    try { store.data.rotation.activities.push(parsePresenceFields(i)); store.save(); startRotation(i.client); return i.reply({ content: '✅ Atividade adicionada.', ephemeral: true }); }
    catch (e) { return i.reply({ content: `❌ ${e.message}`, ephemeral: true }); }
  }
  if (id === 'rotation:edit') return i.reply(activityPicker('rotation:edit:select', 'Escolha para editar'));
  if (id === 'rotation:remove') return i.reply(activityPicker('rotation:remove:select', 'Escolha para remover'));
  if (id === 'rotation:reorder') return i.showModal(makeModal('modal:rotation:reorder', 'Reorganizar atividades', [
    { id: 'from', label: 'Posição atual', placeholder: '1', maxLength: 3 }, { id: 'to', label: 'Nova posição', placeholder: '2', maxLength: 3 },
  ]));
  if (id === 'rotation:edit:select') {
    const idx = Number(i.values[0]); const a = store.data.rotation.activities[idx];
    return i.showModal(makeModal(`modal:rotation:edit:${idx}`, 'Editar atividade', [
      { id: 'type', label: 'Tipo', value: a.type, maxLength: 20 }, { id: 'name', label: 'Texto', value: a.name, maxLength: 128 },
      { id: 'url', label: 'URL streaming (opcional)', value: a.url ?? '', required: false, maxLength: 1000 },
    ]));
  }
  if (id.startsWith('modal:rotation:edit:')) {
    const idx = Number(id.split(':').pop());
    try { store.data.rotation.activities[idx] = parsePresenceFields(i); store.save(); startRotation(i.client); return i.reply({ content: '✅ Atividade atualizada.', ephemeral: true }); }
    catch (e) { return i.reply({ content: `❌ ${e.message}`, ephemeral: true }); }
  }
  if (id === 'rotation:remove:select') {
    store.data.rotation.activities.splice(Number(i.values[0]), 1); store.data.rotation.index = 0; store.save(); startRotation(i.client);
    return i.update({ content: '✅ Atividade removida.', components: [] });
  }
  if (id === 'modal:rotation:reorder') {
    const from = Number(i.fields.getTextInputValue('from')) - 1; const to = Number(i.fields.getTextInputValue('to')) - 1;
    const list = store.data.rotation.activities;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= list.length || to >= list.length) return i.reply({ content: '❌ Posições inválidas.', ephemeral: true });
    const [item] = list.splice(from, 1); list.splice(to, 0, item); store.save(); startRotation(i.client);
    return i.reply({ content: '✅ Ordem atualizada.', ephemeral: true });
  }
  if (id === 'rotation:toggle') {
    if (!store.data.rotation.enabled && !store.data.rotation.activities.length) return i.reply({ content: '❌ Adicione uma atividade antes de ativar.', ephemeral: true });
    store.data.rotation.enabled = !store.data.rotation.enabled; store.save(); startRotation(i.client); return i.update(rotationView());
  }
  if (id === 'rotation:interval') return i.showModal(makeModal('modal:rotation:interval', 'Intervalo da rotação', [{ id: 'seconds', label: 'Segundos (mínimo 15)', value: String(store.data.rotation.intervalSeconds), maxLength: 5 }]));
  if (id === 'modal:rotation:interval') {
    const sec = Number(i.fields.getTextInputValue('seconds'));
    if (!Number.isInteger(sec) || sec < 15 || sec > 86400) return i.reply({ content: '❌ Use um valor entre 15 e 86400 segundos.', ephemeral: true });
    store.data.rotation.intervalSeconds = sec; store.save(); startRotation(i.client); return i.reply({ content: `✅ Intervalo definido para ${sec}s.`, ephemeral: true });
  }

  if (id.startsWith('perm:')) {
    const isOwner = i.user.id === store.data.ownerId;
    if (!isOwner) return i.reply({ content: '❌ Somente o proprietário pode alterar permissões.', ephemeral: true });
    const labels = {
      'perm:user:add': ['modal:perm:user:add','Adicionar usuário','ID do usuário'],
      'perm:user:remove': ['modal:perm:user:remove','Remover usuário','ID do usuário'],
      'perm:role:add': ['modal:perm:role:add','Adicionar cargo','ID do cargo'],
      'perm:role:remove': ['modal:perm:role:remove','Remover cargo','ID do cargo'],
      'perm:owner': ['modal:perm:owner','Definir proprietário','Novo ID do proprietário'],
    };
    if (labels[id]) return i.showModal(makeModal(labels[id][0], labels[id][1], [{ id: 'id', label: labels[id][2], maxLength: 22 }]));
  }

  if (id.startsWith('modal:perm:')) {
    const value = i.fields.getTextInputValue('id').trim();
    if (!validSnowflake(value)) return i.reply({ content: '❌ ID inválido.', ephemeral: true });
    if (id === 'modal:perm:user:add') store.addUser(value);
    if (id === 'modal:perm:user:remove') store.removeUser(value);
    if (id === 'modal:perm:role:add') store.addRole(value);
    if (id === 'modal:perm:role:remove') store.removeRole(value);
    if (id === 'modal:perm:owner') store.setOwner(value);
    return i.reply({ content: '✅ Permissões atualizadas.', ephemeral: true });
  }

  return false;
}
