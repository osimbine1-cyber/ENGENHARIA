const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/rbac');
const { registar } = require('../utils/auditoria');

const router = express.Router();
router.use(autenticar);

const listarPapeisDe = db.prepare(`
  SELECT p.id, p.nome FROM papeis p
  JOIN utilizador_papeis up ON up.papel_id = p.id
  WHERE up.utilizador_id = ?
`);

router.get('/', autorizar('utilizador.gerir'), (req, res) => {
  const utilizadores = db
    .prepare('SELECT id, nome, email, departamento, ativo, criado_em FROM utilizadores ORDER BY nome')
    .all()
    .map((u) => ({ ...u, papeis: listarPapeisDe.all(u.id) }));
  res.json({ utilizadores });
});

router.post('/', autorizar('utilizador.gerir'), (req, res) => {
  const { nome, email, password, departamento, papelIds = [] } = req.body;
  if (!nome || !email || !password) {
    return res.status(400).json({ erro: 'Nome, email e password são obrigatórios.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const transacao = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO utilizadores (nome, email, password_hash, departamento) VALUES (?, ?, ?, ?)')
      .run(nome, email, hash, departamento || null);
    const inserirPapel = db.prepare('INSERT INTO utilizador_papeis (utilizador_id, papel_id) VALUES (?, ?)');
    for (const papelId of papelIds) inserirPapel.run(info.lastInsertRowid, papelId);
    return info.lastInsertRowid;
  });

  try {
    const id = transacao();
    registar({ utilizadorId: req.user.id, acao: 'CRIAR', entidade: 'utilizador', entidadeId: id, ip: req.ip });
    res.status(201).json({ id });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ erro: 'Já existe um utilizador com este email.' });
    }
    res.status(500).json({ erro: 'Erro ao criar utilizador.' });
  }
});

router.put('/:id/papeis', autorizar('utilizador.gerir'), (req, res) => {
  const { papelIds = [] } = req.body;
  const id = Number(req.params.id);

  const transacao = db.transaction(() => {
    db.prepare('DELETE FROM utilizador_papeis WHERE utilizador_id = ?').run(id);
    const inserir = db.prepare('INSERT INTO utilizador_papeis (utilizador_id, papel_id) VALUES (?, ?)');
    for (const papelId of papelIds) inserir.run(id, papelId);
  });
  transacao();

  registar({
    utilizadorId: req.user.id,
    acao: 'ATUALIZAR_PAPEIS',
    entidade: 'utilizador',
    entidadeId: id,
    detalhes: { papelIds },
    ip: req.ip,
  });
  res.json({ ok: true });
});

router.patch('/:id/estado', autorizar('utilizador.gerir'), (req, res) => {
  const { ativo } = req.body;
  const id = Number(req.params.id);
  db.prepare('UPDATE utilizadores SET ativo = ? WHERE id = ?').run(ativo ? 1 : 0, id);
  registar({
    utilizadorId: req.user.id,
    acao: ativo ? 'ATIVAR' : 'DESATIVAR',
    entidade: 'utilizador',
    entidadeId: id,
    ip: req.ip,
  });
  res.json({ ok: true });
});

module.exports = router;
