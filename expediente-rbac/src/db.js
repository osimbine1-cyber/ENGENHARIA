const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const DB_FILE = process.env.DB_FILE || './data/expedientes.db';
const dir = path.dirname(DB_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS utilizadores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  departamento TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS papeis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT
);

CREATE TABLE IF NOT EXISTS permissoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT
);

CREATE TABLE IF NOT EXISTS papel_permissoes (
  papel_id INTEGER NOT NULL REFERENCES papeis(id) ON DELETE CASCADE,
  permissao_id INTEGER NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,
  PRIMARY KEY (papel_id, permissao_id)
);

CREATE TABLE IF NOT EXISTS utilizador_papeis (
  utilizador_id INTEGER NOT NULL REFERENCES utilizadores(id) ON DELETE CASCADE,
  papel_id INTEGER NOT NULL REFERENCES papeis(id) ON DELETE CASCADE,
  PRIMARY KEY (utilizador_id, papel_id)
);

CREATE TABLE IF NOT EXISTS expedientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  assunto TEXT NOT NULL,
  tipo TEXT NOT NULL,
  remetente TEXT NOT NULL,
  destinatario TEXT,
  prioridade TEXT NOT NULL DEFAULT 'normal',
  estado TEXT NOT NULL DEFAULT 'entrada',
  criado_por INTEGER NOT NULL REFERENCES utilizadores(id),
  responsavel_atual INTEGER REFERENCES utilizadores(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tramitacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expediente_id INTEGER NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  de_utilizador INTEGER REFERENCES utilizadores(id),
  para_utilizador INTEGER REFERENCES utilizadores(id),
  estado_anterior TEXT NOT NULL,
  estado_novo TEXT NOT NULL,
  observacao TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS anexos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expediente_id INTEGER NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  nome_ficheiro TEXT NOT NULL,
  tipo_mime TEXT,
  tamanho_bytes INTEGER,
  enviado_por INTEGER REFERENCES utilizadores(id),
  enviado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registos_auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utilizador_id INTEGER REFERENCES utilizadores(id),
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id INTEGER,
  detalhes TEXT,
  endereco_ip TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expedientes_estado ON expedientes(estado);
CREATE INDEX IF NOT EXISTS idx_tramitacoes_expediente ON tramitacoes(expediente_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON registos_auditoria(entidade, entidade_id);
`);

module.exports = db;
