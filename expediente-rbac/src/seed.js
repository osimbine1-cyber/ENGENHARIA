require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const PERMISSOES = [
  ['expediente.criar', 'Registar a entrada de um novo expediente'],
  ['expediente.ler', 'Consultar expedientes e o respectivo histórico'],
  ['expediente.editar', 'Editar dados de um expediente não arquivado'],
  ['expediente.tramitar', 'Encaminhar um expediente entre utilizadores/departamentos'],
  ['expediente.despachar', 'Emitir despacho sobre um expediente'],
  ['expediente.arquivar', 'Arquivar um expediente despachado'],
  ['expediente.eliminar', 'Eliminar definitivamente um expediente'],
  ['utilizador.gerir', 'Criar, activar/desactivar e atribuir papéis a utilizadores'],
  ['papel.gerir', 'Configurar permissões atribuídas a cada papel'],
  ['auditoria.ler', 'Consultar o livro de auditoria do sistema'],
];

const PAPEIS = {
  Administrador: {
    descricao: 'Acesso total ao sistema, incluindo configuração de papéis e permissões.',
    permissoes: PERMISSOES.map((p) => p[0]),
  },
  'Chefe de Departamento': {
    descricao: 'Recebe, despacha e supervisiona expedientes do seu departamento.',
    permissoes: ['expediente.ler', 'expediente.tramitar', 'expediente.despachar', 'expediente.arquivar', 'auditoria.ler'],
  },
  Funcionário: {
    descricao: 'Regista a entrada de expedientes e acompanha a sua tramitação.',
    permissoes: ['expediente.criar', 'expediente.ler', 'expediente.editar', 'expediente.tramitar'],
  },
  Auditor: {
    descricao: 'Acesso apenas de leitura, para fins de fiscalização e conformidade.',
    permissoes: ['expediente.ler', 'auditoria.ler'],
  },
};

const UTILIZADORES_DEMO = [
  { nome: 'Administradora do Sistema', email: 'admin@unisced.ac.mz', password: 'Admin@123', departamento: 'TI', papel: 'Administrador' },
  { nome: 'Chefe do Departamento Jurídico', email: 'chefe@unisced.ac.mz', password: 'Chefe@123', departamento: 'Jurídico', papel: 'Chefe de Departamento' },
  { nome: 'Funcionária de Secretaria', email: 'funcionario@unisced.ac.mz', password: 'Func@123', departamento: 'Secretaria Geral', papel: 'Funcionário' },
  { nome: 'Auditor Interno', email: 'auditor@unisced.ac.mz', password: 'Audit@123', departamento: 'Auditoria Interna', papel: 'Auditor' },
];

function semear() {
  const inserirPermissao = db.prepare('INSERT OR IGNORE INTO permissoes (codigo, descricao) VALUES (?, ?)');
  const transacaoPermissoes = db.transaction(() => {
    for (const [codigo, descricao] of PERMISSOES) inserirPermissao.run(codigo, descricao);
  });
  transacaoPermissoes();

  const inserirPapel = db.prepare('INSERT OR IGNORE INTO papeis (nome, descricao) VALUES (?, ?)');
  const buscarPapelId = db.prepare('SELECT id FROM papeis WHERE nome = ?');
  const buscarPermissaoId = db.prepare('SELECT id FROM permissoes WHERE codigo = ?');
  const ligarPermissao = db.prepare('INSERT OR IGNORE INTO papel_permissoes (papel_id, permissao_id) VALUES (?, ?)');

  const transacaoPapeis = db.transaction(() => {
    for (const [nome, config] of Object.entries(PAPEIS)) {
      inserirPapel.run(nome, config.descricao);
      const papelId = buscarPapelId.get(nome).id;
      for (const codigo of config.permissoes) {
        const permissaoId = buscarPermissaoId.get(codigo).id;
        ligarPermissao.run(papelId, permissaoId);
      }
    }
  });
  transacaoPapeis();

  const inserirUtilizador = db.prepare(
    'INSERT OR IGNORE INTO utilizadores (nome, email, password_hash, departamento) VALUES (?, ?, ?, ?)'
  );
  const buscarUtilizadorId = db.prepare('SELECT id FROM utilizadores WHERE email = ?');
  const ligarPapelUtilizador = db.prepare(
    'INSERT OR IGNORE INTO utilizador_papeis (utilizador_id, papel_id) VALUES (?, ?)'
  );

  const transacaoUtilizadores = db.transaction(() => {
    for (const u of UTILIZADORES_DEMO) {
      const hash = bcrypt.hashSync(u.password, 10);
      inserirUtilizador.run(u.nome, u.email, hash, u.departamento);
      const utilizadorId = buscarUtilizadorId.get(u.email).id;
      const papelId = buscarPapelId.get(u.papel).id;
      ligarPapelUtilizador.run(utilizadorId, papelId);
    }
  });
  transacaoUtilizadores();

  console.log('Seed concluído: papéis, permissões e utilizadores de demonstração criados.');
  console.log('Credenciais de acesso:');
  for (const u of UTILIZADORES_DEMO) {
    console.log(`  ${u.papel.padEnd(22)} -> ${u.email} / ${u.password}`);
  }
}

semear();
