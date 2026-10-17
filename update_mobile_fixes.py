import sys

# 1. Update pagina_inicial/js/scrip.js and script.js (dynamic vhNotifStyles)
new_media_notif = """
      @media (max-width: 768px) {
        .vh-notif-wrapper,
        #vhNotifBellWrapper {
          position: static !important;
        }
        .vh-notif-dropdown,
        #notifDropdown {
          position: fixed !important;
          top: 60px !important;
          left: 12px !important;
          right: 12px !important;
          width: auto !important;
          max-width: calc(100vw - 24px) !important;
          max-height: 80vh !important;
          margin: 0 auto !important;
          box-sizing: border-box !important;
          border-radius: 14px !important;
          z-index: 999999 !important;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85) !important;
        }
        .vh-notif-header {
          padding: 10px 14px !important;
        }
        .vh-notif-list,
        #notifList {
          max-height: 60vh !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          box-sizing: border-box !important;
        }
        .vh-notif-item {
          padding: 10px 12px !important;
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .vh-notif-content {
          min-width: 0 !important;
          flex: 1 !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
        }
        .vh-notif-title {
          font-size: 12.5px !important;
          line-height: 1.3 !important;
        }
        .vh-notif-msg {
          font-size: 11.5px !important;
          line-height: 1.35 !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
        }
      }
"""

for js_file in ['pagina_inicial/js/scrip.js', 'pagina_inicial/js/script.js']:
    try:
        with open(js_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Replace old media query inside vhNotifStyles
        old_pattern = """      @media (max-width: 768px) {
        .vh-notif-dropdown,
        #notifDropdown {
          width: calc(100vw - 32px) !important;
          max-width: 380px !important;
          right: -10px !important;
        }
      }"""

        if old_pattern in content:
            content = content.replace(old_pattern, new_media_notif)
            with open(js_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {js_file} successfully.")
        else:
            print(f"Old pattern not found in {js_file}, appending media query.")
            # find where vhNotifStyles string ends
            idx = content.find('document.head.appendChild(styleEl)')
            if idx != -1:
                content = content[:idx] + new_media_notif + "\n" + content[idx:]
                with open(js_file, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Appended to {js_file}.")
    except Exception as e:
        print(f"Error processing {js_file}: {e}")

# 2. Add comprehensive mobile responsiveness rules to pagina_inicial/css/estilos.css & torneio/detalhes.css
css_rules_to_append = """

/* ==============================================================================
   AJUSTES DEFINITIVOS DE RESPONSIVIDADE MOBILE (NOTIFICAÇÕES & PARTIDAS/CONFRONTOS)
   ============================================================================== */

@media (max-width: 768px) {
  /* DROPDOWN DE NOTIFICAÇÕES (#notifDropdown e #notifList) */
  .vh-notif-wrapper,
  #vhNotifBellWrapper {
    position: static !important;
  }

  .vh-notif-dropdown,
  #notifDropdown {
    position: fixed !important;
    top: 60px !important;
    left: 12px !important;
    right: 12px !important;
    width: auto !important;
    max-width: calc(100vw - 24px) !important;
    max-height: 80vh !important;
    margin: 0 auto !important;
    box-sizing: border-box !important;
    border-radius: 14px !important;
    z-index: 999999 !important;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85) !important;
  }

  .vh-notif-header {
    padding: 10px 14px !important;
  }

  .vh-notif-list,
  #notifList {
    max-height: 60vh !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
    box-sizing: border-box !important;
    width: 100% !important;
  }

  .vh-notif-item {
    padding: 10px 12px !important;
    box-sizing: border-box !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  .vh-notif-content {
    min-width: 0 !important;
    flex: 1 !important;
    word-break: break-word !important;
    overflow-wrap: anywhere !important;
  }

  .vh-notif-title {
    font-size: 12.5px !important;
    line-height: 1.3 !important;
  }

  .vh-notif-msg {
    font-size: 11.5px !important;
    line-height: 1.35 !important;
    word-break: break-word !important;
    overflow-wrap: anywhere !important;
  }

  /* NAVEGAÇÃO DE ABAS DO TORNEIO (INFORMAÇÕES E PARTIDAS & CONFRONTOS) */
  main#torneioPage,
  .torneio-page {
    width: 100% !important;
    max-width: 100vw !important;
    padding-left: 12px !important;
    padding-right: 12px !important;
    box-sizing: border-box !important;
    overflow-x: hidden !important;
  }

  .torneio-nav-container {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
    margin-bottom: 16px !important;
    padding-bottom: 4px !important;
    box-sizing: border-box !important;
    display: flex !important;
  }

  .torneio-tabs-bar {
    display: flex !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    padding: 4px !important;
    gap: 6px !important;
    border-radius: 12px !important;
    flex-wrap: nowrap !important;
  }

  .torneio-tab-btn,
  button#tabBtnBrackets,
  button#tabBtnInfo {
    flex: 1 1 0% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    padding: 10px 8px !important;
    font-size: 12.5px !important;
    justify-content: center !important;
    text-align: center !important;
    white-space: normal !important;
    word-break: break-word !important;
    box-sizing: border-box !important;
    gap: 6px !important;
    display: inline-flex !important;
    align-items: center !important;
  }

  .torneio-tab-btn i {
    font-size: 13px !important;
    flex-shrink: 0 !important;
  }

  /* PANE BRACKETS & SEÇÕES DE CONFRONTOS */
  #paneBrackets,
  .torneio-tab-pane {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    overflow-x: hidden !important;
  }

  .bracket-section-card {
    padding: 16px 12px !important;
    border-radius: 14px !important;
    margin-bottom: 20px !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  .bracket-header-bar {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 12px !important;
  }

  .brackets-tree-wrapper,
  #bracketTree,
  .chaveamento-wrapper,
  .table-partidas-wrapper,
  .bracket-round-col {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
    box-sizing: border-box !important;
  }
}

@media (max-width: 480px) {
  .torneio-tab-btn,
  button#tabBtnBrackets,
  button#tabBtnInfo {
    font-size: 11px !important;
    padding: 8px 4px !important;
    gap: 4px !important;
  }
}
"""

target_css_files = [
    'pagina_inicial/css/estilos.css',
    'torneio/detalhes.css',
    'gerenciartorneios/css/estilo.css',
    'ranking.css',
    'perfil/css/perfil.css',
    'equipes/css/equipes.css'
]

for css_file in target_css_files:
    try:
        with open(css_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if already has our signature block
        if 'AJUSTES DEFINITIVOS DE RESPONSIVIDADE MOBILE' not in content:
            content += css_rules_to_append
            with open(css_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Appended responsive rules to {css_file}.")
        else:
            print(f"Responsive rules already in {css_file}.")
    except Exception as e:
        print(f"Error updating {css_file}: {e}")

