import re

# 1. Synchronize and clean perfil-publico.js and perfil/js/perfil-publico.js
with open("perfil/js/perfil-publico.js", "r", encoding="utf-8") as f:
    pub_content = f.read()

# Clean any remaining gabriel/caique checks in pub_content
pub_content = re.sub(
    r"\s*\|\|\s*\(cleanId\.toLowerCase\(\)\.includes\('gabriel'\).*?\)",
    "",
    pub_content
)

with open("perfil/js/perfil-publico.js", "w", encoding="utf-8") as f:
    f.write(pub_content)

with open("perfil-publico.js", "w", encoding="utf-8") as f:
    f.write(pub_content)

# 2. Clean torneio/js/brackets.js
if True:
    with open("torneio/js/brackets.js", "r", encoding="utf-8") as f:
        b_content = f.read()

    target_block = """        if (!av || av === '/image/boneco_logo_ofc.png') {
          const nm = (m.nome || '').toLowerCase();
          if (nm.includes('caique')) av = '/equipes/images/caiquebrandao.jpg';
          else if (nm.includes('gabriel')) av = '/equipes/images/gabrieloliveira.webp';
          else if (nm.includes('dinho')) av = '/equipes/images/dinhowinches.jpg';
          else if (nm.includes('marcuzcuz')) av = '/equipes/images/marcuzcuz.jpg';
          else av = '/image/boneco_logo_ofc.png';
        }"""
    
    replacement_block = """        if (!av) {
          av = '/image/boneco_logo_ofc.png';
        }"""
    
    if target_block in b_content:
        b_content = b_content.replace(target_block, replacement_block)
        with open("torneio/js/brackets.js", "w", encoding="utf-8") as f:
            f.write(b_content)
        print("Updated torneio/js/brackets.js")

# 3. Clean template_equipe.js and equipes/js/template_equipe.js
for path in ["template_equipe.js", "equipes/js/template_equipe.js"]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            t_content = f.read()
        t_content = t_content.replace("equipe.leaderName || 'caique'", "equipe.leaderName || ''")
        with open(path, "w", encoding="utf-8") as f:
            f.write(t_content)
        print("Updated", path)
    except Exception as e:
        print("Err on", path, e)

print("Refactor clean script executed successfully.")
