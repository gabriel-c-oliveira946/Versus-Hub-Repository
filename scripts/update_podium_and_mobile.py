import sys

# 1. Update torneio/js/brackets.js
with open('torneio/js/brackets.js', 'r', encoding='utf-8') as f:
    text = f.read()

target_str = """          <div class="podium-columns-grid">
            <!-- 1º Lugar (Campeão) -->
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
            ${podium.segundo ? `
              <!-- 2º Lugar (Vice-Campeão) -->
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
            ` : ''}"""

replacement_str = """          <div class="podium-columns-grid">
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
            </div>"""

if target_str in text:
    text = text.replace(target_str, replacement_str)
    with open('torneio/js/brackets.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated torneio/js/brackets.js podium rendering!")
else:
    print("Could not match target_str in torneio/js/brackets.js")


# 2. Update notification styles in pagina_inicial/js/scrip.js and pagina_inicial/js/script.js
for js_file in ['pagina_inicial/js/scrip.js', 'pagina_inicial/js/script.js']:
    try:
        with open(js_file, 'r', encoding='utf-8') as f:
            code = f.read()

        # Ensure .vh-notif-dropdown on mobile has proper width and right positioning
        old_drop = """      .vh-notif-dropdown {
        position: absolute;
        top: calc(100% + 12px);
        right: 0;
        width: 340px;
        max-width: 90vw;
        background: #111118;"""

        new_drop = """      .vh-notif-dropdown {
        position: absolute;
        top: calc(100% + 12px);
        right: 0;
        width: 360px;
        max-width: calc(100vw - 32px);
        background: #111118;"""

        if old_drop in code:
            code = code.replace(old_drop, new_drop)

        # Add responsive media query for notification dropdown
        mobile_notif_css = """
      @media (max-width: 768px) {
        .vh-notif-dropdown,
        #notifDropdown {
          width: calc(100vw - 32px) !important;
          max-width: 380px !important;
          right: -10px !important;
          left: auto !important;
          box-sizing: border-box !important;
        }
      }
"""
        if '.vh-notif-empty i {' in code and 'max-width: 768px' not in code[code.find('vhNotifStyles'):code.find('vhNotifStyles')+5000]:
            code = code.replace('.vh-notif-empty i {', mobile_notif_css + '      .vh-notif-empty i {')

        with open(js_file, 'w', encoding='utf-8') as f:
            f.write(code)
        print(f"Updated notification dropdown styles in {js_file}")
    except Exception as e:
        print(f"Error updating {js_file}: {e}")


# 3. Update CSS files (pagina_inicial/css/estilos.css, torneio/detalhes.css, ranking.css, gerenciartorneios/css/estilo.css)
CSS_MOBILE_BLOCK = """
/* ==========================================================================
   RESPONSIVIDADE MOBILE: DROPDOWN DE NOTIFICAÇÕES & CHAVEAMENTOS / BRACKETS / PÓDIO
   ========================================================================== */
.podium-columns-grid,
.podium-section,
#podiumContainer {
  display: flex !important;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-end;
  gap: 16px;
}

.podium-card.second,
.podium-card.second-place {
  order: 1 !important;
  flex: 1 1 200px;
  max-width: 280px;
}

.podium-card.first,
.podium-card.first-place,
.podium-card.co-first-place {
  order: 2 !important;
  flex: 1 1 220px;
  max-width: 300px;
  transform: translateY(-8px);
  z-index: 2;
}

.podium-card.third,
.podium-card.third-place {
  order: 3 !important;
  flex: 1 1 200px;
  max-width: 280px;
}

@media (max-width: 768px) {
  /* DROPDOWN DE NOTIFICAÇÕES NO CELULAR */
  .vh-notif-dropdown,
  #notifDropdown {
    width: calc(100vw - 32px) !important;
    max-width: 380px !important;
    right: -10px !important;
    left: auto !important;
    box-sizing: border-box !important;
  }

  /* PÓDIO EM EMPILHAMENTO NO MOBILE (CAMPEÃO NO TOPO) */
  .podium-columns-grid,
  .podium-section,
  #podiumContainer {
    flex-direction: column !important;
    align-items: center !important;
    gap: 16px !important;
  }

  .podium-card.first,
  .podium-card.first-place,
  .podium-card.co-first-place {
    order: 1 !important;
    transform: none !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  .podium-card.second,
  .podium-card.second-place {
    order: 2 !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  .podium-card.third,
  .podium-card.third-place {
    order: 3 !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  /* CHAVEAMENTOS, BRACKETS E TABELAS DE PARTIDAS COM ROLAGEM HORIZONTAL */
  .brackets-tree-wrapper,
  .bracket-section-card,
  #bracketTree,
  #chaveamentoContainer,
  .chaveamento-wrapper,
  .brackets-wrapper,
  .table-partidas-wrapper,
  .partidas-container,
  .partidas-table-wrapper,
  .table-responsive {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
    box-sizing: border-box !important;
  }

  /* CARDS DE CONFRONTO E MODAIS */
  .bracket-match-card,
  .card-confronto,
  .match-card,
  .modal-roster-card,
  .modal-detalhes-partida,
  .modal-score-card,
  .modal-confirm-card,
  .modal-manual-bracket-grid,
  .modal-content,
  .modal-card {
    max-width: 100% !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  .bracket-section-card,
  .modal-roster-card,
  .modal-score-card,
  .card-confronto {
    padding: 16px 12px !important;
  }
}
"""

css_files = [
    'pagina_inicial/css/estilos.css',
    'torneio/detalhes.css',
    'ranking.css',
    'gerenciartorneios/css/estilo.css',
    'equipes/css/equipes.css',
    'perfil/css/perfil.css'
]

for css_file in css_files:
    try:
        with open(css_file, 'r', encoding='utf-8') as f:
            css_text = f.read()

        # Append or update CSS mobile block
        if '/* ==========================================================================\n   RESPONSIVIDADE MOBILE: DROPDOWN DE NOTIFICAÇÕES' in css_text:
            idx = css_text.find('/* ==========================================================================\n   RESPONSIVIDADE MOBILE: DROPDOWN DE NOTIFICAÇÕES')
            css_text = css_text[:idx].rstrip() + '\n' + CSS_MOBILE_BLOCK
        elif 'REORDENAÇÃO DO PÓDIO & RESPONSIVIDADE MOBILE' in css_text:
            idx = css_text.find('REORDENAÇÃO DO PÓDIO & RESPONSIVIDADE MOBILE')
            # find previous comment star or start line
            start_pos = css_text.rfind('/*', 0, idx)
            if start_pos != -1:
                css_text = css_text[:start_pos].rstrip() + '\n' + CSS_MOBILE_BLOCK
            else:
                css_text = css_text[:idx].rstrip() + '\n' + CSS_MOBILE_BLOCK
        else:
            css_text = css_text.rstrip() + '\n' + CSS_MOBILE_BLOCK

        with open(css_file, 'w', encoding='utf-8') as f:
            f.write(css_text)
        print(f"Updated CSS block in {css_file}")
    except Exception as e:
        print(f"Error updating {css_file}: {e}")

