import { ActivityType } from 'discord.js';
import { store } from '../config/store.js';

let timer = null;

export const activityTypes = {
  playing: ActivityType.Playing,
  streaming: ActivityType.Streaming,
  listening: ActivityType.Listening,
  watching: ActivityType.Watching,
  competing: ActivityType.Competing,
};

export function normalizeActivity(activity) {
  if (!activity?.name) return null;
  return {
    name: String(activity.name).slice(0, 128),
    type: activityTypes[activity.type] ?? ActivityType.Playing,
    ...(activity.type === 'streaming' && activity.url ? { url: activity.url } : {}),
  };
}

export function applyStaticPresence(client) {
  const activity = normalizeActivity(store.data.presence);
  client.user.setPresence({
    status: store.data.status ?? 'online',
    activities: activity ? [activity] : [],
  });
}

export function stopRotation() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function startRotation(client) {
  stopRotation();
  const rotation = store.data.rotation;
  if (!rotation.enabled || !rotation.activities.length) {
    applyStaticPresence(client);
    return;
  }

  const tick = () => {
    const list = store.data.rotation.activities;
    if (!store.data.rotation.enabled || !list.length) return;
    const index = Math.abs(store.data.rotation.index || 0) % list.length;
    const activity = normalizeActivity(list[index]);
    client.user.setPresence({ status: store.data.status ?? 'online', activities: activity ? [activity] : [] });
    store.data.rotation.index = (index + 1) % list.length;
    store.save();
  };

  tick();
  const delay = Math.max(15, Number(rotation.intervalSeconds) || 60) * 1000;
  timer = setInterval(tick, delay);
}

export function refreshPresence(client) {
  if (store.data.rotation.enabled) startRotation(client);
  else applyStaticPresence(client);
}
