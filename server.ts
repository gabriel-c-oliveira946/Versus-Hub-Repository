import express from "express";
import path from "path";
import fs from "fs";

const app = express();
const PORT = 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log requests for debugging navigation
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// Serve direct root files & folders statically
app.use("/image", express.static(path.join(process.cwd(), "image")));
app.use("/images", express.static(path.join(process.cwd(), "images")));
app.use("/equipes", express.static(path.join(process.cwd(), "equipes")));
app.use("/torneio", express.static(path.join(process.cwd(), "torneio")));
app.use("/pagina_inicial", express.static(path.join(process.cwd(), "pagina_inicial")));
app.use(express.static(path.join(process.cwd())));

// Main landing redirection to /pagina_inicial/index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "pagina_inicial", "index.html"));
});

// Custom fallback route handling for clean folder URLs
// e.g., if navigating to "/login", serves "/login/login.html"
app.get("/:folder", (req, res, next) => {
  const folder = req.params.folder;
  
  if (!folder.includes(".")) {
    const folderPath = path.join(process.cwd(), folder);
    
    // Check if directory exists
    if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
      const htmlPath = path.join(folderPath, `${folder}.html`);
      const indexPath = path.join(folderPath, "index.html");

      if (fs.existsSync(htmlPath)) {
        return res.sendFile(htmlPath);
      } else if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }
  }
  next();
});

// Custom error handling
app.use((req, res) => {
  res.status(404).send(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #050407; color: white; min-height: 100vh;">
      <h1 style="color: #ff3333;">404 - Página não encontrada</h1>
      <p style="color: #ccc;">Não conseguimos encontrar a página: <strong>${req.originalUrl}</strong></p>
      <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #d41111; color: white; border-radius: 20px; text-decoration: none; font-weight: bold;">Voltar para o Início</a>
    </div>
  `);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Versus Hub running on http://localhost:${PORT}`);
  console.log(`Current working directory: ${process.cwd()}`);
  try {
    const imgDir = path.join(process.cwd(), "image");
    const imgsDir = path.join(process.cwd(), "images");
    console.log(`Image dir exists: ${fs.existsSync(imgDir)}, files:`, fs.existsSync(imgDir) ? fs.readdirSync(imgDir).slice(0, 5) : "none");
    console.log(`Images dir exists: ${fs.existsSync(imgsDir)}, files:`, fs.existsSync(imgsDir) ? fs.readdirSync(imgsDir).slice(0, 5) : "none");
  } catch (e: any) {
    console.error("Error reading image directories:", e.message);
  }
});
