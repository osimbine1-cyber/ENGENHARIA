const express = require('express');
const db = require('../db');
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/rbac');

const router = express.Router();
router.use(autenticar);

router.get('/', autorizar('auditoria.ler'), (req, res) => {
  const { entidade, utilizadorId, limite = 200 } = req.query;
  let sql = `SELECT a.*, u.nome AS utilizador_nome
             FROM registos_auditoria a
             LEFT JOIN utilizadores u ON u.id = a.utilizador_id
             WHERE 1=1`;
  const params = [];
  if (entidade) {
    sql += ' AND a.entidade = ?';
    params.push(entidade);
  }
  if (utilizadorId) {
    sql += ' AND a.utilizador_id = ?';
    params.push(Number(utilizadorId));
  }
  sql += ' ORDER BY a.criado_em DESC LIMIT ?';
  params.push(Number(limite));

  res.json({ registos: db.prepare(sql).all(...params) });
});

module.exports = router;
