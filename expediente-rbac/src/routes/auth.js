const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { autenticar } = require('../middleware/auth');
const { registar } = require('../utils/auditoria');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ erro: 'Email e password são obrigatórios.' });
  }

  const utilizador = db.prepare('SELECT * FROM utilizadores WHERE email = ?').get(email);

  if (!utilizador || !utilizador.ativo || !bcrypt.compareSync(password, utilizador.password_hash)) {
    registar({ acao: 'LOGIN_FALHADO', entidade: 'utilizador', detalhes: { email }, ip: req.ip });
    return res.status(401).json({ erro: 'Credenciais inválidas.' });
  }

  const token = jwt.sign({ sub: utilizador.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  const papeis = db
    .prepare(
      `SELECT p.nome FROM papeis p
       JOIN utilizador_papeis up ON up.papel_id = p.id
       WHERE up.utilizador_id = ?`
    )
    .all(utilizador.id)
    .map((r) => r.nome);

  registar({ utilizadorId: utilizador.id, acao: 'LOGIN', entidade: 'utilizador', entidadeId: utilizador.id, ip: req.ip });

  res.json({
    token,
    utilizador: {
      id: utilizador.id,
      nome: utilizador.nome,
      email: utilizador.email,
      departamento: utilizador.departamento,
      papeis,
    },
  });
});

router.get('/me', autenticar, (req, res) => {
  res.json({ utilizador: req.user });
});

module.exports = router;
