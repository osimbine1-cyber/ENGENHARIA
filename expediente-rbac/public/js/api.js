const Api = (() => {
  const BASE = '/api';

  async function pedido(caminho, opcoes = {}) {
    const token = localStorage.getItem('token');
    const resposta = await fetch(BASE + caminho, {
      ...opcoes,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opcoes.headers || {}),
      },
    });

    if (resposta.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('utilizador');
      if (!location.pathname.endsWith('index.html') && location.pathname !== '/') {
        window.location.href = 'index.html';
      }
    }

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || `Erro ${resposta.status}`);
    return dados;
  }

  return {
    login: (email, password) => pedido('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    eu: () => pedido('/auth/me'),
    listarExpedientes: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return pedido(`/expedientes${qs ? '?' + qs : ''}`);
    },
    obterExpediente: (id) => pedido(`/expedientes/${id}`),
    criarExpediente: (dados) => pedido('/expedientes', { method: 'POST', body: JSON.stringify(dados) }),
    editarExpediente: (id, dados) => pedido(`/expedientes/${id}`, { method: 'PUT', body: JSON.stringify(dados) }),
    tramitar: (id, dados) => pedido(`/expedientes/${id}/tramitar`, { method: 'POST', body: JSON.stringify(dados) }),
    despachar: (id, dados) => pedido(`/expedientes/${id}/despachar`, { method: 'POST', body: JSON.stringify(dados) }),
    arquivar: (id, dados) => pedido(`/expedientes/${id}/arquivar`, { method: 'POST', body: JSON.stringify(dados) }),
    eliminar: (id) => pedido(`/expedientes/${id}`, { method: 'DELETE' }),
    listarUtilizadores: () => pedido('/users'),
    criarUtilizador: (dados) => pedido('/users', { method: 'POST', body: JSON.stringify(dados) }),
    definirEstadoUtilizador: (id, ativo) => pedido(`/users/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ ativo }) }),
    definirPapeisUtilizador: (id, papelIds) => pedido(`/users/${id}/papeis`, { method: 'PUT', body: JSON.stringify({ papelIds }) }),
    listarPapeis: () => pedido('/roles'),
    listarAuditoria: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return pedido(`/audit${qs ? '?' + qs : ''}`);
    },
  };
})();
