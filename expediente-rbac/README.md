# Sistema de Gestão de Expedientes — RBAC

Trabalho de Campo de **Engenharia de Software** — UnISCED, Faculdade de Engenharia e Agricultura, Curso de Licenciatura em Engenharia Informática.

Sistema web para automatizar o ciclo de vida de expedientes administrativos (**entrada → tramitação → despacho → arquivo**), com controlo de acesso baseado em papéis (RBAC), auditoria integral de acções e API REST documentada.

## Índice

- [Arquitectura](#arquitectura)
- [Modelo de permissões (RBAC)](#modelo-de-permissões-rbac)
- [Requisitos](#requisitos)
- [Instalação e execução](#instalação-e-execução)
- [Contas de demonstração](#contas-de-demonstração)
- [Referência da API](#referência-da-api)
- [Estrutura do projecto](#estrutura-do-projecto)
- [Autores](#autores)

## Arquitectura

| Camada | Tecnologia | Justificação |
|---|---|---|
| Backend / API | Node.js + Express | Ecossistema maduro, middleware nativo adequado a RBAC, curva de aprendizagem compatível com o prazo da disciplina |
| Base de dados | SQLite (`better-sqlite3`) | Zero-configuração, ficheiro único versionável em ambiente de ensino, API síncrona que simplifica transacções |
| Autenticação | JWT (`jsonwebtoken`) + `bcryptjs` | Sessões sem estado no servidor; password nunca armazenada em texto simples |
| Frontend | HTML + CSS + JavaScript nativo | Sem necessidade de build step; demonstra o consumo da API sem esconder a lógica de autorização atrás de uma framework |

A autorização segue um modelo clássico de RBAC em três níveis: **utilizador → papel → permissão**. Um utilizador nunca detém uma permissão directamente; herda-a do(s) papel(éis) que lhe é(são) atribuído(s). Isto permite reconfigurar o acesso de um grupo inteiro de utilizadores alterando um único papel, sem tocar em cada conta individualmente.

## Modelo de permissões (RBAC)

| Papel | Permissões concedidas |
|---|---|
| **Administrador** | Todas as permissões, incluindo gestão de utilizadores e configuração de papéis |
| **Chefe de Departamento** | Consultar, tramitar, despachar e arquivar expedientes; consultar auditoria |
| **Funcionário** | Registar entrada, consultar, editar e tramitar expedientes |
| **Auditor** | Apenas leitura: consultar expedientes e o livro de auditoria |

Cada pedido HTTP autenticado passa por dois middlewares sequenciais:

1. **`autenticar`** — valida o token JWT e carrega o utilizador, os seus papéis e o conjunto de permissões efectivas (calculado em cada pedido, para que uma alteração de papel produza efeito imediato, sem exigir novo login).
2. **`autorizar(permissão)`** — verifica se alguma das permissões do utilizador cobre a acção pedida; caso contrário devolve `403 Forbidden` e **regista a tentativa no livro de auditoria**, cumprindo o requisito de rastreabilidade do enunciado.

## Requisitos

- Node.js ≥ 18
- npm ≥ 9

Não é necessário instalar SQLite separadamente — o driver `better-sqlite3` inclui o motor embebido.

## Instalação e execução

```bash
# 1. Clonar o repositório
git clone <URL_DO_REPOSITORIO>
cd expediente-rbac

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# edite .env e defina um JWT_SECRET próprio antes de qualquer uso fora do ambiente de testes

# 4. Popular a base de dados com papéis, permissões e utilizadores de demonstração
npm run seed

# 5. Iniciar o servidor
npm start
```

A aplicação fica disponível em **http://localhost:3000**. A página inicial é o ecrã de autenticação; após o login, o utilizador é redireccionado para `dashboard.html`, onde o menu é construído dinamicamente consoante as permissões do seu papel.

Para desenvolvimento com recarregamento automático:

```bash
npm run dev
```

## Contas de demonstração

O script `npm run seed` cria quatro contas, uma por papel:

| Papel | Email | Password |
|---|---|---|
| Administrador | `admin@unisced.ac.mz` | `Admin@123` |
| Chefe de Departamento | `chefe@unisced.ac.mz` | `Chefe@123` |
| Funcionário | `funcionario@unisced.ac.mz` | `Func@123` |
| Auditor | `auditor@unisced.ac.mz` | `Audit@123` |

> Estas credenciais destinam-se exclusivamente à demonstração académica do sistema. Nunca devem ser reutilizadas num ambiente de produção.

## Referência da API

Todas as rotas — excepto `POST /api/auth/login` — exigem o cabeçalho `Authorization: Bearer <token>`.

| Método | Rota | Permissão exigida | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | — | Autentica e devolve um token JWT |
| GET | `/api/auth/me` | token válido | Devolve a identidade e permissões do utilizador autenticado |
| GET | `/api/expedientes` | `expediente.ler` | Lista expedientes, com filtros `estado` e `q` |
| GET | `/api/expedientes/:id` | `expediente.ler` | Detalhe, histórico de tramitação e anexos de um expediente |
| POST | `/api/expedientes` | `expediente.criar` | Regista a entrada de um novo expediente |
| PUT | `/api/expedientes/:id` | `expediente.editar` | Actualiza dados de um expediente não arquivado |
| POST | `/api/expedientes/:id/tramitar` | `expediente.tramitar` | Encaminha o expediente, mantendo-o em tramitação |
| POST | `/api/expedientes/:id/despachar` | `expediente.despachar` | Regista o despacho (transição para `despachado`) |
| POST | `/api/expedientes/:id/arquivar` | `expediente.arquivar` | Arquiva um expediente despachado |
| DELETE | `/api/expedientes/:id` | `expediente.eliminar` | Elimina definitivamente um expediente |
| GET | `/api/users` | `utilizador.gerir` | Lista utilizadores e os seus papéis |
| POST | `/api/users` | `utilizador.gerir` | Cria um novo utilizador |
| PATCH | `/api/users/:id/estado` | `utilizador.gerir` | Activa ou desactiva uma conta |
| PUT | `/api/users/:id/papeis` | `utilizador.gerir` | Redefine os papéis atribuídos a um utilizador |
| GET | `/api/roles` | `utilizador.gerir` ou `papel.gerir` | Lista papéis e as suas permissões |
| PUT | `/api/roles/:id/permissoes` | `papel.gerir` | Redefine as permissões de um papel |
| GET | `/api/audit` | `auditoria.ler` | Consulta o livro de auditoria, com filtros `entidade` e `utilizadorId` |

Todas as transições de estado de um expediente são validadas no servidor contra a máquina de estados `entrada → em_tramitacao → despachado → arquivado`; um pedido que tente saltar etapas é rejeitado com `409 Conflict`, independentemente do que a interface permita clicar.

## Estrutura do projecto

```
expediente-rbac/
├── src/
│   ├── server.js              # Ponto de entrada da aplicação Express
│   ├── db.js                  # Ligação SQLite e definição do esquema
│   ├── seed.js                 # Povoamento de papéis, permissões e utilizadores
│   ├── middleware/
│   │   ├── auth.js            # Verificação de JWT e carregamento de permissões
│   │   └── rbac.js            # Middleware de autorização (autorizar)
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── roles.js
│   │   ├── expedientes.js     # Ciclo de vida do expediente e máquina de estados
│   │   └── audit.js
│   └── utils/
│       └── auditoria.js       # Função central de registo no livro de auditoria
├── public/                     # Interface web (HTML/CSS/JS nativo)
├── tests/
├── .env.example
├── package.json
└── README.md
```

## Autores

- Osvaldo [Apelido] — nº de estudante [____]
- Walter [Apelido] — nº de estudante [____]

Disciplina de Engenharia de Software, Curso de Licenciatura em Engenharia Informática, UnISCED — Universidade Aberta ISCED, Faculdade de Engenharia e Agricultura.
