import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Servir arquivos estáticos de todo o projeto
app.use(express.static(__dirname));

// Rota raiz redireciona para a página inicial
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'pagina_inicial', 'index.html'));
});

// Fallback para rota /pagina_inicial se requisitado sem extensão
app.get('/pagina_inicial', (_req, res) => {
  res.sendFile(path.join(__dirname, 'pagina_inicial', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VersusHub dev server running at http://0.0.0.0:${PORT}`);
});
