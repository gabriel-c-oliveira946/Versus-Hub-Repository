with open('torneio/js/brackets.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx_start = text.find('<div class="podium-columns-grid">\n            <!-- 1º Lugar (Campeão) -->')
if idx_start == -1:
    idx_start = text.find('<div class="podium-columns-grid">')

print("idx_start:", idx_start)
if idx_start != -1:
    # Let's locate up to ${podium.terceiro ?
    idx_end = text.find('${podium.terceiro ?', idx_start)
    print("idx_end:", idx_end)
    if idx_end != -1:
        old_snippet = text[idx_start:idx_end]
        new_snippet = """<div class="podium-columns-grid">
            ${podium.segundo ? `
              <!-- 2º Lugar (Vice-Campeão - Esquerda) -->
              <div class="podium-card second-place">
                <div class="podium-rank-tag">
                  <i class="fa-solid fa-award"></i> 2º Lugar · Vice-Campeão
                </div>
                <h4 class="podium-winner-name">${escapeHtml(podium.segundo.nome)}</h4>
                <div class="podium-winner-stats">
                  <span>Vitórias: <strong>${podium.segundo.wins || 0}</strong></span>
                  <span>Saldo: <strong>${(podium.segundo.totalPlacar || 0) - (podium.segundo.placarSofrido || 0)}</strong></span>
                  <span>Bônus: <strong>+250 pts</strong></span>
                </div>
              </div>
            ` : ''}
            <!-- 1º Lugar (Campeão - Centro Destaque) -->
            <div class="podium-card first-place">
              <div class="podium-rank-tag">
                <i class="fa-solid fa-crown"></i> 1º Lugar · Campeão
              </div>
              <h4 class="podium-winner-name">${escapeHtml(podium.primeiro.nome)}</h4>
              <div class="podium-winner-stats">
                <span>Vitórias: <strong>${podium.primeiro.wins || 0}</strong></span>
                <span>Saldo: <strong>${(podium.primeiro.totalPlacar || 0) - (podium.primeiro.placarSofrido || 0)}</strong></span>
                <span>Bônus: <strong>+500 pts</strong></span>
              </div>
            </div>
            """
        text = text[:idx_start] + new_snippet + text[idx_end:]
        with open('torneio/js/brackets.js', 'w', encoding='utf-8') as f:
            f.write(text)
        print("Successfully updated torneio/js/brackets.js podium rendering!")

