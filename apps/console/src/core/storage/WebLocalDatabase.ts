export type WebRecord = Record<string, unknown>;

interface WebLocalDatabaseShape {
  counters: Record<string, number>;
  tables: Record<string, WebRecord[]>;
}

import { storageKey } from "../../config/appBranding";

const STORAGE_KEY = storageKey("desktop-web-db-v1");

const nowIso = () => new Date().toISOString();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function initialDatabase(): WebLocalDatabaseShape {
  const adminUser = {
    id: 1,
    nome: "Administrador",
    login: "legacy-disabled",
    email: null,
    telefone: null,
    cargo: "Administrador",
    administrador: true,
    master_user: true,
    senha_provisoria: false,
    ativo: false,
    senha: "",
    permission_keys: ["*"],
    profile_names: ["Administrador"],
    company_ids: [1],
    company_names: ["Empresa Demonstração"],
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  return {
    counters: {
      companies: 1,
      users: 1,
      profiles: 1,
      app_logs: 0,
      sync_queue: 0,
      integrations: 0,
    },
    tables: {
      companies: [
        {
          id: 1,
          nome: "Empresa Demonstração",
          razao_social: "Empresa Demonstração LTDA",
          documento: "00.000.000/0001-00",
          telefone: "(00) 00000-0000",
          email: "contato@local.test",
          cidade: "Demonstração",
          estado: "BA",
          ativo: true,
          created_at: nowIso(),
          updated_at: nowIso(),
        },
      ],
      users: [adminUser],
      profiles: [
        {
          id: 1,
          nome: "Administrador",
          descricao: "Perfil administrativo local para modo Web/PWA.",
          ativo: true,
          permission_keys: ["*"],
          created_at: nowIso(),
          updated_at: nowIso(),
        },
      ],
      app_logs: [],
      sync_queue: [],
      integrations: [],
      departamentos: [
        { id: 1, descricao: "Administrativo", ativo: true, created_at: nowIso(), updated_at: nowIso() },
      ],
      funcoes: [
        { id: 1, descricao: "Administrador", ativo: true, created_at: nowIso(), updated_at: nowIso() },
      ],
      centro_custos: [],
      clientes: [],
      fornecedores: [],
      produtos: [],
    },
  };
}

export class WebLocalDatabase {
  private read(): WebLocalDatabaseShape {
    if (typeof window === "undefined") return initialDatabase();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const db = initialDatabase();
      this.write(db);
      return db;
    }
    try {
      const parsed = JSON.parse(raw) as WebLocalDatabaseShape;
      parsed.counters ||= {};
      parsed.tables ||= {};
      return parsed;
    } catch {
      const db = initialDatabase();
      this.write(db);
      return db;
    }
  }

  private write(db: WebLocalDatabaseShape): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  table(name: string): WebRecord[] {
    const db = this.read();
    db.tables[name] ||= [];
    this.write(db);
    return clone(db.tables[name]);
  }

  list(name: string, search = ""): WebRecord[] {
    const rows = this.table(name);
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalizedSearch));
  }

  get(name: string, id: number): WebRecord | null {
    return this.table(name).find((row) => Number(row.id) === Number(id)) ?? null;
  }

  save(name: string, payload: WebRecord): WebRecord {
    const db = this.read();
    db.tables[name] ||= [];
    db.counters[name] ||= db.tables[name].reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
    const id = typeof payload.id === "number" && Number.isFinite(payload.id) ? payload.id : null;
    const timestamp = nowIso();

    if (id !== null) {
      const index = db.tables[name].findIndex((row) => Number(row.id) === Number(id));
      if (index >= 0) {
        db.tables[name][index] = {
          ...db.tables[name][index],
          ...clone(payload),
          id,
          updated_at: timestamp,
        };
        this.write(db);
        return clone(db.tables[name][index]);
      }
    }

    db.counters[name] += 1;
    const created = {
      ...clone(payload),
      id: db.counters[name],
      created_at: timestamp,
      updated_at: timestamp,
    };
    db.tables[name].push(created);
    this.write(db);
    return clone(created);
  }

  delete(name: string, id: number): boolean {
    const db = this.read();
    db.tables[name] ||= [];
    const before = db.tables[name].length;
    db.tables[name] = db.tables[name].filter((row) => Number(row.id) !== Number(id));
    this.write(db);
    return db.tables[name].length !== before;
  }

  clear(name: string): void {
    const db = this.read();
    db.tables[name] = [];
    this.write(db);
  }
}
