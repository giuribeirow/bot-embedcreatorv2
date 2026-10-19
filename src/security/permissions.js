import { store } from '../config/store.js';

export function bootstrapOwnerFromEnv() {
  const envOwner = process.env.OWNER_ID?.trim();
  if (envOwner && !store.data.ownerId) store.setOwner(envOwner);
}

export async function isAuthorized(subject) {
  const userId = subject.user?.id ?? subject.author?.id;
  if (!userId) return false;
  if (userId === store.data.ownerId) return true;
  if (store.data.authorizedUsers.includes(userId)) return true;

  let member = subject.member ?? null;
  if (!member && subject.guild) {
    try { member = await subject.guild.members.fetch(userId); } catch { member = null; }
  }
  if (!member) return false;

  return store.data.authorizedRoles.some(roleId => member.roles.cache.has(roleId));
}

export async function guardInteraction(interaction) {
  if (await isAuthorized(interaction)) return true;
  const payload = { content: '❌ Você não possui acesso a este painel.', ephemeral: true };
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch {}
  return false;
}
