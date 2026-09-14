const { registar } = require('../utils/auditoria');

/**
 * Middleware de controlo de acesso baseado em papéis (RBAC).
 *
 * `autorizar('expediente.despachar')` só deixa o pedido prosseguir se
 * alguma das funções atribuídas ao utilizador autenticado detiver essa
 * permissão. Cada tentativa negada é registada no livro de auditoria,
 * o que cumpre o requisito de rastreabilidade do enunciado — não é
 * apenas o sucesso que fica registado, mas também a tentativa de acesso
 * indevido.
 */
function autorizar(...permissoesNecessarias) {
  return (req, res, next) => {
    const { user } = req;
    if (!user) {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }

    const autorizado = permissoesNecessarias.some((p) => user.permissoes.includes(p));

    if (!autorizado) {
      registar({
        utilizadorId: user.id,
        acao: 'ACESSO_NEGADO',
        entidade: 'permissao',
        detalhes: { necessarias: permissoesNecessarias, rota: req.originalUrl },
        ip: req.ip,
      });
      return res.status(403).json({
        erro: 'Acesso negado: o seu papel não detém a permissão necessária.',
        permissao_necessaria: permissoesNecessarias,
      });
    }

    next();
  };
}

module.exports = { autorizar };
