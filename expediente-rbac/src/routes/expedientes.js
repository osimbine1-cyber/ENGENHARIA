const express = require('express');
const db = require('../db');
const { autenticar } = require('../middleware/auth');
const { autorizar } = require('../middleware/rbac');
const { registar } = require('../utils/auditoria');

const router = express.Router();
router.use(autenticar);

// Transições de estado permitidas no ciclo de vida do expediente.
// Qualquer transição fora deste mapa é rejeitada, garantindo que o
// fluxo administrativo (entrada -> tramitação -> despacho -> arquivo)
// não pode ser corrompido por um pedido malformado.
const TRANSICOES = {
  entrada: ['em_tramitacao'],
  em_tramitacao: ['em_tramitacao', 'despachado'],
  despachado: ['arquivado', 'em_tramitacao'],
  arquivado: [],
};

function gerarNumero() {
  const ano = new Date().getFullYear();
  const seq = db.prepare("SELECT COUNT(*) AS n FROM expedientes WHERE numero LIKE ?").get(`EXP-${ano}-%`).n + 1;
  return `EXP-${ano}-${String(seq).padStart(5, '0')}`;
}

router.get('/', autorizar('expediente.ler'), (req, res) => {
  const { estado, q } = req.query;
  let sql = `SELECT e.*, u.nome AS criado_por_nome, r.nome AS responsavel_nome
             FROM expedientes e
             JOIN utilizadores u ON u.id = e.criado_por
             LEFT JOIN utilizadores r ON r.id = e.responsavel_atual
             WHERE 1=1`;
  const params = [];
  if (estado) {
    sql += ' AND e.estado = ?';
    params.push(estado);
  }
  if (q) {
    sql += ' AND (e.assunto LIKE ? OR e.numero LIKE ? OR e.remetente LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY e.criado_em DESC';
  res.json({ expedientes: db.prepare(sql).all(...params) });
});

router.get('/:id', autorizar('expediente.ler'), (req, res) => {
  const id = Number(req.params.id);
  const expediente = db.prepare('SELECT * FROM expedientes WHERE id = ?').get(id);
  if (!expediente) return res.status(404).json({ erro: 'Expediente não encontrado.' });

  const historico = db
    .prepare(
      `SELECT t.*, u1.nome AS de_nome, u2.nome AS para_nome
       FROM tramitacoes t
       LEFT JOIN utilizadores u1 ON u1.id = t.de_utilizador
       LEFT JOIN utilizadores u2 ON u2.id = t.para_utilizador
       WHERE t.expediente_id = ? ORDER BY t.criado_em ASC`
    )
    .all(id);

  const anexos = db.prepare('SELECT * FROM anexos WHERE expediente_id = ? ORDER BY enviado_em ASC').all(id);

  res.json({ expediente, historico, anexos });
});

router.post('/', autorizar('expediente.criar'), (req, res) => {
  const { assunto, tipo, remetente, destinatario, prioridade } = req.body;
  if (!assunto || !tipo || !remetente) {
    return res.status(400).json({ erro: 'Assunto, tipo e remetente são obrigatórios.' });
  }

  const numero = gerarNumero();
  const transacao = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO expedientes (numero, assunto, tipo, remetente, destinatario, prioridade, estado, criado_por, responsavel_atual)
         VALUES (?, ?, ?, ?, ?, ?, 'entrada', ?, ?)`
      )
      .run(numero, assunto, tipo, remetente, destinatario || null, prioridade || 'normal', req.user.id, req.user.id);

    db.prepare(
      `INSERT INTO tramitacoes (expediente_id, de_utilizador, para_utilizador, estado_anterior, estado_novo, observacao)
       VALUES (?, ?, ?, 'inexistente', 'entrada', 'Registo de entrada do expediente.')`
    ).run(info.lastInsertRowid, req.user.id, req.user.id);

    return info.lastInsertRowid;
  });

  const id = transacao();
  registar({ utilizadorId: req.user.id, acao: 'CRIAR', entidade: 'expediente', entidadeId: id, detalhes: { numero }, ip: req.ip });
  res.status(201).json({ id, numero });
});

router.put('/:id', autorizar('expediente.editar'), (req, res) => {
  const id = Number(req.params.id);
  const expediente = db.prepare('SELECT * FROM expedientes WHERE id = ?').get(id);
  if (!expediente) return res.status(404).json({ erro: 'Expediente não encontrado.' });
  if (expediente.estado === 'arquivado') {
    return res.status(409).json({ erro: 'Um expediente arquivado não pode ser editado.' });
  }

  const { assunto, tipo, remetente, destinatario, prioridade } = req.body;
  db.prepare(
    `UPDATE expedientes SET assunto = ?, tipo = ?, remetente = ?, destinatario = ?, prioridade = ?, atualizado_em = datetime('now')
     WHERE id = ?`
  ).run(
    assunto ?? expediente.assunto,
    tipo ?? expediente.tipo,
    remetente ?? expediente.remetente,
    destinatario ?? expediente.destinatario,
    prioridade ?? expediente.prioridade,
    id
  );

  registar({ utilizadorId: req.user.id, acao: 'EDITAR', entidade: 'expediente', entidadeId: id, ip: req.ip });
  res.json({ ok: true });
});

// Transição genérica de estado — usada para tramitar, despachar e arquivar.
// A permissão exigida depende do estado de destino, reflectindo que
// despachar e arquivar são acções administrativas mais sensíveis do que
// uma simples tramitação interna.
function transicionar(estadoNovo, permissao) {
  return (req, res) => {
    const id = Number(req.params.id);
    const { paraUtilizadorId, observacao } = req.body;
    const expediente = db.prepare('SELECT * FROM expedientes WHERE id = ?').get(id);
    if (!expediente) return res.status(404).json({ erro: 'Expediente não encontrado.' });

    const permitidos = TRANSICOES[expediente.estado] || [];
    if (!permitidos.includes(estadoNovo)) {
      return res.status(409).json({
        erro: `Transição de '${expediente.estado}' para '${estadoNovo}' não é permitida.`,
      });
    }

    const transacao = db.transaction(() => {
      db.prepare(
        `UPDATE expedientes SET estado = ?, responsavel_atual = ?, atualizado_em = datetime('now') WHERE id = ?`
      ).run(estadoNovo, paraUtilizadorId || expediente.responsavel_atual, id);

      db.prepare(
        `INSERT INTO tramitacoes (expediente_id, de_utilizador, para_utilizador, estado_anterior, estado_novo, observacao)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, req.user.id, paraUtilizadorId || null, expediente.estado, estadoNovo, observacao || null);
    });
    transacao();

    registar({
      utilizadorId: req.user.id,
      acao: `TRANSICAO_${estadoNovo.toUpperCase()}`,
      entidade: 'expediente',
      entidadeId: id,
      detalhes: { de: expediente.estado, para: estadoNovo },
      ip: req.ip,
    });

    res.json({ ok: true, estado: estadoNovo });
  };
}

router.post('/:id/tramitar', autorizar('expediente.tramitar'), transicionar('em_tramitacao', 'expediente.tramitar'));
router.post('/:id/despachar', autorizar('expediente.despachar'), transicionar('despachado', 'expediente.despachar'));
router.post('/:id/arquivar', autorizar('expediente.arquivar'), transicionar('arquivado', 'expediente.arquivar'));

router.delete('/:id', autorizar('expediente.eliminar'), (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM expedientes WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ erro: 'Expediente não encontrado.' });
  registar({ utilizadorId: req.user.id, acao: 'ELIMINAR', entidade: 'expediente', entidadeId: id, ip: req.ip });
  res.json({ ok: true });
});

module.exports = router;
