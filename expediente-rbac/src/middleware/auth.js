const jwt = require('jsonwebtoken');
const db = require('../db');

const buscarPapeisEPermissoes = db.prepare(`
  SELECT DISTINCT p.nome AS papel, perm.codigo AS permissao
  FROM utilizador_papeis up
  JOIN papeis p ON p.id = up.papel_id
  LEFT JOIN papel_permissoes pp ON pp.papel_id = p.id
  LEFT JOIN permissoes perm ON perm.id = pp.permissao_id
  WHERE up.utilizador_id = ?
`);

/**
 * Verifica o token JWT, confirma que o utilizador continua activo e
 * anexa a `req.user` a identidade, os papéis e o conjunto de permissões
 * efectivas — calculadas em cada pedido para reflectir alterações de
 * papel imediatamente, sem exigir novo login.
 */
function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: 'Token de autenticação em falta.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }

  const utilizador = db
    .prepare('SELECT id, nome, email, departamento, ativo FROM utilizadores WHERE id = ?')
    .get(payload.sub);

  if (!utilizador || !utilizador.ativo) {
    return res.status(401).json({ erro: 'Conta inexistente ou desactivada.' });
  }

  const linhas = buscarPapeisEPermissoes.all(utilizador.id);
  const papeis = [...new Set(linhas.map((l) => l.papel))];
  const permissoes = [...new Set(linhas.map((l) => l.permissao).filter(Boolean))];

  req.user = { ...utilizador, papeis, permissoes };
  next();
}

module.exports = { autenticar };
