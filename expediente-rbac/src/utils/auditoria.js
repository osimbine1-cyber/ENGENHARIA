const db = require('../db');

const inserir = db.prepare(`
  INSERT INTO registos_auditoria (utilizador_id, acao, entidade, entidade_id, detalhes, endereco_ip)
  VALUES (@utilizador_id, @acao, @entidade, @entidade_id, @detalhes, @endereco_ip)
`);

/**
 * Regista uma acção no livro de auditoria. Nunca deve lançar excepção que
 * interrompa o fluxo principal do pedido — falhas de auditoria são
 * registadas na consola, não propagadas ao utilizador.
 */
function registar({ utilizadorId, acao, entidade, entidadeId, detalhes, ip }) {
  try {
    inserir.run({
      utilizador_id: utilizadorId ?? null,
      acao,
      entidade,
      entidade_id: entidadeId ?? null,
      detalhes: detalhes ? JSON.stringify(detalhes) : null,
      endereco_ip: ip ?? null,
    });
  } catch (err) {
    console.error('[auditoria] falha ao registar evento:', err.message);
  }
}

module.exports = { registar };
