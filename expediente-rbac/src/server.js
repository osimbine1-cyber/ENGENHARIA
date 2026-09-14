require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const expedienteRoutes = require('./routes/expedientes');
const auditRoutes = require('./routes/audit');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/expedientes', expedienteRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/health', (req, res) => res.json({ estado: 'operacional', hora: new Date().toISOString() }));

// Middleware de erro central — evita que uma excepção não tratada exponha
// detalhes internos (stack trace, caminhos de ficheiro) ao cliente.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sistema de Gestão de Expedientes a correr em http://localhost:${PORT}`);
});
