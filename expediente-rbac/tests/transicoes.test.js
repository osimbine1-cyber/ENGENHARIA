const { test } = require('node:test');
const assert = require('node:assert');

// Réplica isolada da máquina de estados usada em src/routes/expedientes.js,
// para testar as regras de transição sem depender de uma base de dados viva.
const TRANSICOES = {
  entrada: ['em_tramitacao'],
  em_tramitacao: ['em_tramitacao', 'despachado'],
  despachado: ['arquivado', 'em_tramitacao'],
  arquivado: [],
};

function transicaoPermitida(de, para) {
  return (TRANSICOES[de] || []).includes(para);
}

test('entrada pode transitar para em_tramitacao', () => {
  assert.strictEqual(transicaoPermitida('entrada', 'em_tramitacao'), true);
});

test('entrada não pode saltar directamente para despachado', () => {
  assert.strictEqual(transicaoPermitida('entrada', 'despachado'), false);
});

test('em_tramitacao pode transitar para despachado', () => {
  assert.strictEqual(transicaoPermitida('em_tramitacao', 'despachado'), true);
});

test('despachado pode ser devolvido a em_tramitacao', () => {
  assert.strictEqual(transicaoPermitida('despachado', 'em_tramitacao'), true);
});

test('despachado pode transitar para arquivado', () => {
  assert.strictEqual(transicaoPermitida('despachado', 'arquivado'), true);
});

test('arquivado é um estado terminal', () => {
  assert.strictEqual(transicaoPermitida('arquivado', 'em_tramitacao'), false);
  assert.strictEqual(transicaoPermitida('arquivado', 'despachado'), false);
});
