let UTILIZADOR = null;
let ABA_ATIVA = 'expedientes';
let PAPEIS_CACHE = [];

const ROTULOS_ESTADO = {
  entrada: 'Entrada',
  em_tramitacao: 'Em tramitação',
  despachado: 'Despachado',
  arquivado: 'Arquivado',
};

function tem(permissao) {
  return UTILIZADOR && UTILIZADOR.permissoes.includes(permissao);
}

function abrirModal(html) {
  document.getElementById('modal-corpo').innerHTML = html;
  document.getElementById('modal-fundo').classList.remove('escondido');
}
function fecharModal() {
  document.getElementById('modal-fundo').classList.add('escondido');
}
document.getElementById('modal-fundo').addEventListener('click', (e) => {
  if (e.target.id === 'modal-fundo') fecharModal();
});

async function iniciar() {
  const token = localStorage.getItem('token');
  if (!token) return (window.location.href = 'index.html');

  try {
    const { utilizador } = await Api.eu();
    UTILIZADOR = utilizador;
  } catch {
    return (window.location.href = 'index.html');
  }

  document.getElementById('nome-utilizador').textContent = UTILIZADOR.nome;
  document.getElementById('papel-atual').textContent = UTILIZADOR.papeis.join(', ');
  document.getElementById('btn-sair').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
  });

  montarMenu();
  renderizarAba();
}

function montarMenu() {
  const abas = [{ id: 'expedientes', rotulo: 'Expedientes', permissao: 'expediente.ler' }];
  if (tem('utilizador.gerir')) abas.push({ id: 'utilizadores', rotulo: 'Utilizadores' });
  if (tem('papel.gerir') || tem('utilizador.gerir')) abas.push({ id: 'papeis', rotulo: 'Papéis & Permissões' });
  if (tem('auditoria.ler')) abas.push({ id: 'auditoria', rotulo: 'Auditoria' });

  const menu = document.getElementById('menu');
  menu.innerHTML = '';
  abas.forEach((aba) => {
    const btn = document.createElement('button');
    btn.textContent = aba.rotulo;
    btn.className = aba.id === ABA_ATIVA ? 'ativo' : '';
    btn.addEventListener('click', () => {
      ABA_ATIVA = aba.id;
      montarMenu();
      renderizarAba();
    });
    menu.appendChild(btn);
  });
}

function renderizarAba() {
  const el = document.getElementById('conteudo');
  if (!tem('expediente.ler') && ABA_ATIVA === 'expedientes') {
    el.innerHTML = '<p class="aviso-acesso">O seu papel não tem permissão para consultar expedientes.</p>';
    return;
  }
  if (ABA_ATIVA === 'expedientes') return renderizarExpedientes();
  if (ABA_ATIVA === 'utilizadores') return renderizarUtilizadores();
  if (ABA_ATIVA === 'papeis') return renderizarPapeis();
  if (ABA_ATIVA === 'auditoria') return renderizarAuditoria();
}

// ---------- EXPEDIENTES ----------
async function renderizarExpedientes(filtro = {}) {
  const el = document.getElementById('conteudo');
  el.innerHTML = '<p>A carregar expedientes…</p>';
  const { expedientes } = await Api.listarExpedientes(filtro);

  el.innerHTML = `
    <div class="barra-acoes">
      <div>
        <input type="text" id="pesquisa" placeholder="Pesquisar por número, assunto ou remetente" value="${filtro.q || ''}" />
        <select id="filtro-estado">
          <option value="">Todos os estados</option>
          ${Object.entries(ROTULOS_ESTADO).map(([v, r]) => `<option value="${v}" ${filtro.estado === v ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>
      ${tem('expediente.criar') ? '<button class="botao-primario" id="btn-novo">+ Novo expediente</button>' : ''}
    </div>
    <table>
      <thead><tr><th>Número</th><th>Assunto</th><th>Remetente</th><th>Prioridade</th><th>Estado</th><th>Actualizado</th></tr></thead>
      <tbody id="corpo-tabela"></tbody>
    </table>
  `;

  const corpo = document.getElementById('corpo-tabela');
  if (expedientes.length === 0) {
    corpo.innerHTML = '<tr><td colspan="6">Nenhum expediente encontrado.</td></tr>';
  }
  expedientes.forEach((exp) => {
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${exp.numero}</td>
      <td>${exp.assunto}</td>
      <td>${exp.remetente}</td>
      <td>${exp.prioridade}</td>
      <td><span class="badge badge-${exp.estado}">${ROTULOS_ESTADO[exp.estado]}</span></td>
      <td>${exp.atualizado_em}</td>
    `;
    linha.addEventListener('click', () => abrirDetalheExpediente(exp.id));
    corpo.appendChild(linha);
  });

  document.getElementById('pesquisa').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') aplicarFiltros();
  });
  document.getElementById('filtro-estado').addEventListener('change', aplicarFiltros);
  function aplicarFiltros() {
    renderizarExpedientes({
      q: document.getElementById('pesquisa').value,
      estado: document.getElementById('filtro-estado').value,
    });
  }

  const btnNovo = document.getElementById('btn-novo');
  if (btnNovo) btnNovo.addEventListener('click', abrirFormularioNovoExpediente);
}

function abrirFormularioNovoExpediente() {
  abrirModal(`
    <h2>Registar entrada de expediente</h2>
    <form id="form-novo-expediente">
      <label>Assunto</label>
      <input type="text" id="ne-assunto" required />
      <label>Tipo</label>
      <select id="ne-tipo">
        <option>Requerimento</option>
        <option>Ofício</option>
        <option>Circular</option>
        <option>Memorando</option>
        <option>Reclamação</option>
      </select>
      <label>Remetente</label>
      <input type="text" id="ne-remetente" required />
      <label>Destinatário</label>
      <input type="text" id="ne-destinatario" />
      <label>Prioridade</label>
      <select id="ne-prioridade">
        <option value="normal">Normal</option>
        <option value="urgente">Urgente</option>
      </select>
      <p class="erro" id="ne-erro"></p>
      <div class="modal-acoes">
        <button type="button" class="botao-neutro" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="botao-primario">Registar</button>
      </div>
    </form>
  `);
  document.getElementById('form-novo-expediente').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await Api.criarExpediente({
        assunto: document.getElementById('ne-assunto').value,
        tipo: document.getElementById('ne-tipo').value,
        remetente: document.getElementById('ne-remetente').value,
        destinatario: document.getElementById('ne-destinatario').value,
        prioridade: document.getElementById('ne-prioridade').value,
      });
      fecharModal();
      renderizarExpedientes();
    } catch (err) {
      document.getElementById('ne-erro').textContent = err.message;
    }
  });
}

async function abrirDetalheExpediente(id) {
  const { expediente, historico } = await Api.obterExpediente(id);

  const acoes = [];
  if (expediente.estado === 'entrada' || expediente.estado === 'em_tramitacao') {
    if (tem('expediente.tramitar')) acoes.push(`<button class="botao-primario" data-acao="tramitar">Tramitar</button>`);
  }
  if (expediente.estado === 'em_tramitacao' && tem('expediente.despachar')) {
    acoes.push(`<button class="botao-primario" data-acao="despachar">Despachar</button>`);
  }
  if (expediente.estado === 'despachado' && tem('expediente.arquivar')) {
    acoes.push(`<button class="botao-primario" data-acao="arquivar">Arquivar</button>`);
  }
  if (tem('expediente.eliminar')) {
    acoes.push(`<button class="botao-perigo" data-acao="eliminar">Eliminar</button>`);
  }

  abrirModal(`
    <h2>${expediente.numero} — ${expediente.assunto}</h2>
    <p><span class="badge badge-${expediente.estado}">${ROTULOS_ESTADO[expediente.estado]}</span>
       &nbsp; Prioridade: <strong>${expediente.prioridade}</strong></p>
    <p><strong>Remetente:</strong> ${expediente.remetente} &nbsp; <strong>Destinatário:</strong> ${expediente.destinatario || '—'}</p>
    <h3 style="font-size:0.9rem;margin-top:1.25rem;">Histórico de tramitação</h3>
    <div>
      ${historico
        .map(
          (h) => `<div class="historico-item">
            <div>${ROTULOS_ESTADO[h.estado_anterior] || h.estado_anterior} → <strong>${ROTULOS_ESTADO[h.estado_novo]}</strong></div>
            <div class="meta">${h.criado_em} · por ${h.de_nome || '—'}${h.observacao ? ' · ' + h.observacao : ''}</div>
          </div>`
        )
        .join('') || '<p>Sem registos.</p>'}
    </div>
    ${acoes.length ? `<div class="modal-acoes" id="acoes-expediente">${acoes.join('')}</div>` : ''}
    <div class="modal-acoes"><button class="botao-neutro" onclick="fecharModal()">Fechar</button></div>
  `);

  const container = document.getElementById('acoes-expediente');
  if (container) {
    container.querySelectorAll('button[data-acao]').forEach((btn) => {
      btn.addEventListener('click', () => executarAcaoExpediente(expediente.id, btn.dataset.acao));
    });
  }
}

async function executarAcaoExpediente(id, acao) {
  if (acao === 'eliminar') {
    if (!confirm('Eliminar definitivamente este expediente? Esta acção não pode ser desfeita.')) return;
    await Api.eliminar(id);
    fecharModal();
    return renderizarExpedientes();
  }
  const observacao = prompt('Observação (opcional):') || '';
  try {
    if (acao === 'tramitar') await Api.tramitar(id, { observacao });
    if (acao === 'despachar') await Api.despachar(id, { observacao });
    if (acao === 'arquivar') await Api.arquivar(id, { observacao });
    fecharModal();
    renderizarExpedientes();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- UTILIZADORES ----------
async function renderizarUtilizadores() {
  const el = document.getElementById('conteudo');
  el.innerHTML = '<p>A carregar utilizadores…</p>';
  const [{ utilizadores }, { papeis }] = await Promise.all([Api.listarUtilizadores(), Api.listarPapeis()]);
  PAPEIS_CACHE = papeis;

  el.innerHTML = `
    <div class="barra-acoes">
      <div></div>
      <button class="botao-primario" id="btn-novo-utilizador">+ Novo utilizador</button>
    </div>
    <table>
      <thead><tr><th>Nome</th><th>Email</th><th>Departamento</th><th>Papéis</th><th>Estado</th><th></th></tr></thead>
      <tbody>
        ${utilizadores
          .map(
            (u) => `<tr>
              <td>${u.nome}</td><td>${u.email}</td><td>${u.departamento || '—'}</td>
              <td>${u.papeis.map((p) => `<span class="chip">${p.nome}</span>`).join('') || '—'}</td>
              <td>${u.ativo ? 'Activo' : 'Inactivo'}</td>
              <td><button class="botao-neutro" data-id="${u.id}" data-ativo="${u.ativo}" class="btn-alternar">${u.ativo ? 'Desactivar' : 'Activar'}</button></td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;

  el.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await Api.definirEstadoUtilizador(Number(btn.dataset.id), btn.dataset.ativo === '0');
      renderizarUtilizadores();
    });
  });

  document.getElementById('btn-novo-utilizador').addEventListener('click', () => abrirFormularioNovoUtilizador(papeis));
}

function abrirFormularioNovoUtilizador(papeis) {
  abrirModal(`
    <h2>Novo utilizador</h2>
    <form id="form-novo-utilizador">
      <label>Nome completo</label>
      <input type="text" id="nu-nome" required />
      <label>Email</label>
      <input type="email" id="nu-email" required />
      <label>Palavra-passe inicial</label>
      <input type="password" id="nu-password" required minlength="6" />
      <label>Departamento</label>
      <input type="text" id="nu-departamento" />
      <label>Papel</label>
      <select id="nu-papel">
        ${papeis.map((p) => `<option value="${p.id}">${p.nome}</option>`).join('')}
      </select>
      <p class="erro" id="nu-erro"></p>
      <div class="modal-acoes">
        <button type="button" class="botao-neutro" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="botao-primario">Criar</button>
      </div>
    </form>
  `);
  document.getElementById('form-novo-utilizador').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await Api.criarUtilizador({
        nome: document.getElementById('nu-nome').value,
        email: document.getElementById('nu-email').value,
        password: document.getElementById('nu-password').value,
        departamento: document.getElementById('nu-departamento').value,
        papelIds: [Number(document.getElementById('nu-papel').value)],
      });
      fecharModal();
      renderizarUtilizadores();
    } catch (err) {
      document.getElementById('nu-erro').textContent = err.message;
    }
  });
}

// ---------- PAPÉIS & PERMISSÕES ----------
async function renderizarPapeis() {
  const el = document.getElementById('conteudo');
  el.innerHTML = '<p>A carregar papéis…</p>';
  const { papeis } = await Api.listarPapeis();

  el.innerHTML = papeis
    .map(
      (p) => `<div class="painel">
        <strong>${p.nome}</strong> — <span style="color:#666;font-size:0.85rem;">${p.descricao || ''}</span>
        <div style="margin-top:0.5rem;">
          ${p.permissoes.map((c) => `<span class="chip">${c}</span>`).join('') || '<em>Sem permissões atribuídas.</em>'}
        </div>
      </div>`
    )
    .join('');
}

// ---------- AUDITORIA ----------
async function renderizarAuditoria() {
  const el = document.getElementById('conteudo');
  el.innerHTML = '<p>A carregar livro de auditoria…</p>';
  const { registos } = await Api.listarAuditoria();

  el.innerHTML = `
    <table>
      <thead><tr><th>Data</th><th>Utilizador</th><th>Acção</th><th>Entidade</th><th>ID</th></tr></thead>
      <tbody>
        ${registos
          .map(
            (r) => `<tr>
              <td>${r.criado_em}</td><td>${r.utilizador_nome || '—'}</td><td>${r.acao}</td><td>${r.entidade}</td><td>${r.entidade_id ?? '—'}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

iniciar();
