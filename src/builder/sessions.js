const sessions = new Map();

function emptySession(userId, guildId) {
  return {
    userId,
    guildId,
    type: null,
    content: '',
    embed: {
      title: '', titleUrl: '', description: '', color: null,
      author: null, thumbnail: '', image: '', fields: [], footer: null, timestamp: false,
    },
    buttons: [],
    menus: [],
    blocks: [],
    history: [],
    selectedBlock: null,
    selectedItem: null,
    channelId: null,
    preview: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function serializableState(s) {
  return {
    type: s.type,
    content: s.content,
    embed: structuredClone(s.embed),
    buttons: structuredClone(s.buttons),
    menus: structuredClone(s.menus),
    blocks: structuredClone(s.blocks),
    selectedBlock: s.selectedBlock,
    selectedItem: s.selectedItem,
    channelId: s.channelId,
  };
}

export function getSession(userId, guildId = null) {
  const key = `${guildId ?? 'dm'}:${userId}`;
  if (!sessions.has(key)) sessions.set(key, emptySession(userId, guildId));
  const s = sessions.get(key);
  s.updatedAt = Date.now();
  return s;
}

export function pushHistory(s) {
  s.history.push(serializableState(s));
  if (s.history.length > 20) s.history.shift();
}

export function undo(s) {
  const prev = s.history.pop();
  if (!prev) return false;
  Object.assign(s, prev);
  return true;
}

export function resetSession(s, keepType = true) {
  const type = keepType ? s.type : null;
  const fresh = emptySession(s.userId, s.guildId);
  Object.assign(s, fresh, { type });
}
