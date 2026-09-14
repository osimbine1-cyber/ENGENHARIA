const express = require('express');
const db = require('../db');
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/rbac');
const { registar } = require('../utils/auditoria');

const router = express.Router();
router.use(autenticar);

router.get('/', autorizar('utilizador.gerir', 'papel.gerir'), (req, res) => {
  const papeis = db.prepare('SELECT * FROM papeis ORDER BY nome').all();
  const permissoesPorPapel = db.prepare(`
    SELECT perm.codigo FROM papel_permissoes pp
    JOIN permissoes perm ON perm.id = pp.permissao_id
    WHERE pp.papel_id = ?
  `);
  res.json({
    papeis: papeis.map((p) => ({ ...p, permissoes: permissoesPorPapel.all(p.id).map((r) => r.codigo) })),
  });
});

router.get('/permissoes', autorizar('utilizador.gerir', 'papel.gerir'), (req, res) => {
  res.json({ permissoes: db.prepare('SELECT * FROM permissoes ORDER BY codigo').all() });
});

router.put('/:id/permissoes', autorizar('papel.gerir'), (req, res) => {
  const { permissaoIds = [] } = req.body;
  const id = Number(req.params.id);

  const transacao = db.transaction(() => {
    db.prepare('DELETE FROM papel_permissoes WHERE papel_id = ?').run(id);
    const inserir = db.prepare('INSERT INTO papel_permissoes (papel_id, permissao_id) VALUES (?, ?)');
    for (const permissaoId of permissaoIds) inserir.run(id, permissaoId);
  });
  transacao();

  registar({
    utilizadorId: req.user.id,
    acao: 'ATUALIZAR_PERMISSOES',
    entidade: 'papel',
    entidadeId: id,
    detalhes: { permissaoIds },
    ip: req.ip,
  });
  res.json({ ok: true });
});

module.exports = router;
