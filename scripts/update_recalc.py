with open('torneio/js/brackets.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx_start = text.find("if (novoStatus === 'Encerrado') {")
idx_end = text.find("try {\n      const created = JSON.parse(localStorage.getItem('vh_createdTournaments')", idx_start)

if idx_start != -1 and idx_end != -1:
    recalc_replacement = """if (novoStatus === 'Encerrado') {
      try {
        console.log('[VersusHub Notificações] RecalcularStatus detectou encerramento. Notificando participantes:', torneioId);
        const { data: inscs, error: errInscRecalc } = await supabase
          .from('inscricoes')
          .select('user_email')
          .eq('torneio_id', String(torneioId));

        if (errInscRecalc) {
          console.error('[VersusHub Notificações] Erro ao consultar inscrições no recalcularStatus:', errInscRecalc);
        } else if (inscs && Array.isArray(inscs) && inscs.length > 0) {
          const notifRecords = [...new Set(inscs.map(i => (i.user_email || '').toLowerCase().trim()).filter(Boolean))]
            .map(email => ({
              user_email: email,
              titulo: 'Torneio Encerrado!',
              mensagem: 'O torneio foi finalizado e os campeões foram consolidados!',
              tipo: 'torneio',
              lida: false,
              link: `/torneio/custom.html?id=${encodeURIComponent(torneioId)}`
            }));

          if (notifRecords.length > 0) {
            const { data: insData, error: insErr } = await supabase.from('notificacoes').insert(notifRecords).select();
            if (insErr) {
              console.error('[VersusHub Notificações] Erro ao inserir notificações de encerramento via recalcularStatus:', insErr);
            } else {
              console.log('[VersusHub Notificações] Notificações de encerramento enviadas via recalcularStatus:', insData);
            }
          }
        }
      } catch (eNotif) {
        console.error('[VersusHub Notificações] Exceção no disparo de notificações de encerramento via recalcularStatus:', eNotif);
      }
    }
    """
    text = text[:idx_start] + recalc_replacement + text[idx_end:]
    with open('torneio/js/brackets.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated recalcularStatus in brackets.js successfully.")
else:
    print("Could not find start or end index.")
