import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '../../data/config.json');

const DEFAULTS = {
  ownerId: '',
  authorizedUsers: [],
  authorizedRoles: [],
  status: 'online',
  presence: null,
  rotation: {
    enabled: false,
    intervalSeconds: 60,
    index: 0,
    activities: [],
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDefaults(raw = {}) {
  return {
    ...clone(DEFAULTS),
    ...raw,
    authorizedUsers: Array.isArray(raw.authorizedUsers) ? raw.authorizedUsers : [],
    authorizedRoles: Array.isArray(raw.authorizedRoles) ? raw.authorizedRoles : [],
    rotation: {
      ...clone(DEFAULTS.rotation),
      ...(raw.rotation ?? {}),
      activities: Array.isArray(raw.rotation?.activities) ? raw.rotation.activities : [],
    },
  };
}

export class ConfigStore {
  constructor() {
    this.data = clone(DEFAULTS);
    this.load();
  }

  load() {
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      if (!fs.existsSync(DATA_FILE)) {
        this.save();
        return;
      }
      this.data = mergeDefaults(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
    } catch (error) {
      console.error('[STORE] Falha ao carregar config:', error);
      this.data = clone(DEFAULTS);
    }
  }

  save() {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
  }

  setOwner(id) {
    this.data.ownerId = String(id || '');
    this.save();
  }

  addUser(id) {
    id = String(id);
    if (!this.data.authorizedUsers.includes(id)) this.data.authorizedUsers.push(id);
    this.save();
  }

  removeUser(id) {
    this.data.authorizedUsers = this.data.authorizedUsers.filter(x => x !== String(id));
    this.save();
  }

  addRole(id) {
    id = String(id);
    if (!this.data.authorizedRoles.includes(id)) this.data.authorizedRoles.push(id);
    this.save();
  }

  removeRole(id) {
    this.data.authorizedRoles = this.data.authorizedRoles.filter(x => x !== String(id));
    this.save();
  }
}

export const store = new ConfigStore();
