// /criar_torneio/js/criar.js
import { supabase } from '/supabaseClient.js';

// Limpeza preventiva total de torneios estáticos




document.addEventListener('DOMContentLoaded', async () => {
  const STORAGE_KEY = 'vh_createdTournaments';

  // --- LOGIN VERIFICATION COM SUPABASE AUTH ---
  let loggedUser = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      const email = session.user.email;
      const raw = localStorage.getItem("vh_loggedUser");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.email === email) loggedUser = parsed;
        } catch (e) {}
      }
      if (!loggedUser) {
        const { data: profile } = await supabase.from('usuarios').select('id, nome, email, "dataNasc", bio, avatar, regiao, "jogosFavoritos", plataformas, banner, stats, conquistas').eq('email', email).maybeSingle();
        loggedUser = {
          id: profile?.id || session.user.id,
          nome: profile?.nome || session.user.user_metadata?.nome || email.split('@')[0],
          email: email,
          avatar: profile?.avatar || '/image/boneco_logo_ofc.png',
          auth_id: session.user.id
        };
        localStorage.setItem("vh_loggedUser", JSON.stringify(loggedUser));
      }
    }
  } catch (err) {
    console.warn("Aviso ao validar auth em criar.js:", err);
  }

  if (!loggedUser) {
    const container = document.querySelector('.criar-torneio-page');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: #141419; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); max-width: 600px; margin: 80px auto; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <i class="fa-solid fa-lock" style="font-size: 56px; display: block; margin-bottom: 20px; color: #ffffff;"></i>
          <h2 style="font-size: 28px; font-weight: 800; color: #ffffff; margin-bottom: 12px; font-family: system-ui, sans-serif;">Área Restrita</h2>
          <p style="font-size: 16px; color: #9ca3af; margin-bottom: 30px; line-height: 1.6; font-family: system-ui, sans-serif;">Você precisa estar logado na sua conta VersusHub para poder criar e gerenciar torneios.</p>
          <div style="display: flex; gap: 15px; justify-content: center;">
            <a href="/login/login.html" class="btn-principal-criar" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">Fazer Login</a>
            <a href="/pagina_inicial/index.html" class="btn-secondary-criar" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">Voltar ao Início</a>
          </div>
        </div>
      `;
    }
    return;
  }

  const form = document.getElementById('formCriarTorneio');
  if (!form) return;

  // --- WIZARD STATES ---
  let currentStep = 1;
  const totalSteps = 3;

  // --- STEP PANEL ELEMENTS ---
  const panels = {
    1: document.getElementById('stepPanel1'),
    2: document.getElementById('stepPanel2'),
    3: document.getElementById('stepPanel3')
  };

  const indicators = {
    1: document.getElementById('stepIndicator1'),
    2: document.getElementById('stepIndicator2'),
    3: document.getElementById('stepIndicator3')
  };

  const progressBar = document.getElementById('stepperProgress');
  const btnPrev = document.getElementById('btnPrevStep');
  const btnNext = document.getElementById('btnNextStep');
  const feedbackMsg = document.getElementById('feedbackMsg');

  // --- FORM INPUT ELEMENTS ---
  const bannerInput = document.getElementById('bannerInput');
  const uploadContainer = document.getElementById('uploadContainer');
  const bannerPreviewWrapper = document.getElementById('bannerPreviewWrapper');
  const bannerImagePreview = document.getElementById('bannerImagePreview');
  
  const nomeTorneio = document.getElementById('nomeTorneio');
  const jogoNome = document.getElementById('jogoNome');
  
  // Hidden inputs for tiles
  const categoriaInput = document.getElementById('categoria');
  const plataformaInput = document.getElementById('plataforma');
  const modalidadeInput = document.getElementById('modalidade');
  const taxaTipoInput = document.getElementById('taxaTipo');
  const tipoPremioInput = document.getElementById('tipoPremio');

  // Inputs
  const inicioData = document.getElementById('inicioData');
  const inicioHora = document.getElementById('inicioHora');
  const statusSelect = document.getElementById('status');
  const tipoInscricaoSelect = document.getElementById('tipoInscricao');
  const maxIntegrantesInput = document.getElementById('maxIntegrantes');
  const maxIntegrantesBlock = document.getElementById('maxIntegrantesBlock');
  const maxParticipantesInput = document.getElementById('maxParticipantes');
  const descricao = document.getElementById('descricao');
  const localizacao = document.getElementById('localizacao');
  const requisitos = document.getElementById('requisitos');
  const regras = document.getElementById('regras');
  const taxaValor = document.getElementById('taxaValor');

  // Ajuste interativo do campo de integrantes com base no tipo de inscrição
  if (tipoInscricaoSelect && maxIntegrantesInput) {
    tipoInscricaoSelect.addEventListener('change', () => {
      const val = tipoInscricaoSelect.value;
      if (val === 'Apenas Solo (1v1)') {
        maxIntegrantesInput.value = '1';
        maxIntegrantesInput.disabled = true;
        if (maxIntegrantesBlock) maxIntegrantesBlock.style.opacity = '0.5';
      } else {
        maxIntegrantesInput.disabled = false;
        if (maxIntegrantesBlock) maxIntegrantesBlock.style.opacity = '1';
        if (maxIntegrantesInput.value === '1' || !maxIntegrantesInput.value) {
          maxIntegrantesInput.value = '5';
        }
      }
    });

    // Botões de preset rápido (1, 2, 3, 4, 5)
    const presetBtns = document.querySelectorAll('.btn-preset-integrantes');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.getAttribute('data-size');
        if (size) {
          maxIntegrantesInput.value = size;
          if (size === '1') {
            if (tipoInscricaoSelect.value === 'Apenas Equipe') {
              tipoInscricaoSelect.value = 'Solo ou Equipe';
            }
          }
        }
      });
    });

    // Sugestão dinâmica de tamanho de equipe ao escolher o jogo
    if (jogoNome) {
      jogoNome.addEventListener('input', () => {
        const j = (jogoNome.value || '').toLowerCase();
        if (tipoInscricaoSelect.value !== 'Apenas Solo (1v1)') {
          if (j.includes('rocket league')) maxIntegrantesInput.value = '3';
          else if (j.includes('free fire') || j.includes('pubg')) maxIntegrantesInput.value = '4';
          else if (j.includes('cs:go') || j.includes('cs2') || j.includes('valorant') || j.includes('league of legends') || j.includes('dota') || j.includes('rainbow')) maxIntegrantesInput.value = '5';
          else if (j.includes('fifa') || j.includes('fc 2') || j.includes('clash') || j.includes('street') || j.includes('tekken')) {
            maxIntegrantesInput.value = '1';
          }
        }
      });
    }
  }

  const premio1 = document.getElementById('premio1');
  const premio2 = document.getElementById('premio2');
  const premio3 = document.getElementById('premio3');
  const premiacaoExtra = document.getElementById('premiacaoExtra');

  let bannerDataUrl = ''; // Base64 data of custom banner

  // --- CONDITIONAL BLOCK SHOW/HIDE ---
  const localizacaoBlock = document.getElementById('localizacaoBlock');
  const taxaValorBlock = document.getElementById('taxaValorBlock');
  const premiacaoCampos = document.getElementById('premiacaoCampos');

  // --- INITIALIZE INTERACTIVE TILE SELECTORS ---
  const formatoTorneioInput = document.getElementById('formatoTorneio');
  setupTileSelector('formatoSelector', formatoTorneioInput);

  setupTileSelector('categoriaSelector', categoriaInput);
  setupTileSelector('plataformaSelector', plataformaInput);
  setupTileSelector('modalidadeSelector', modalidadeInput, (value) => {
    if (value === 'presencial') {
      localizacaoBlock.style.display = 'block';
      localizacao.setAttribute('required', 'true');
    } else {
      localizacaoBlock.style.display = 'none';
      localizacao.removeAttribute('required');
      localizacao.value = '';
    }
  });
  setupTileSelector('taxaTipoSelector', taxaTipoInput, (value) => {
    if (value === 'pago') {
      taxaValorBlock.style.display = 'block';
      taxaValor.setAttribute('required', 'true');
    } else {
      taxaValorBlock.style.display = 'none';
      taxaValor.removeAttribute('required');
      taxaValor.value = '';
    }
  });
  setupTileSelector('tipoPremioSelector', tipoPremioInput, (value) => {
    if (value !== 'nenhuma') {
      premiacaoCampos.style.display = 'block';
      premio1.setAttribute('required', 'true');
    } else {
      premiacaoCampos.style.display = 'none';
      premio1.removeAttribute('required');
      premio1.value = '';
      premio2.value = '';
      premio3.value = '';
      premiacaoExtra.value = '';
    }
  });

  function setupTileSelector(containerId, hiddenInput, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const options = container.querySelectorAll('.tile-option');
    options.forEach(option => {
      option.addEventListener('click', () => {
        // Unselect siblings
        options.forEach(opt => opt.classList.remove('selected'));
        // Select clicked
        option.classList.add('selected');
        // Update input value
        const val = option.getAttribute('data-value');
        hiddenInput.value = val;
        // Run callback if exists
        if (callback) callback(val);
      });
    });
  }

  // --- DRAG & DROP FILE UPLOAD WITH PREVIEW ---
  if (bannerInput && uploadContainer) {
    // Sync click
    uploadContainer.addEventListener('click', () => {
      bannerInput.click();
    });

    // Drag-and-drop effects
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadContainer.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadContainer.style.borderColor = '#d41111';
        uploadContainer.style.background = '#1a1015';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadContainer.addEventListener(eventName, (e) => {
        e.preventDefault();
        uploadContainer.style.borderColor = '#272735';
        uploadContainer.style.background = '#121217';
      }, false);
    });

    uploadContainer.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length) {
        bannerInput.files = files;
        handleFile(files[0]);
      }
    });

    bannerInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    });
  }

  async function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    try {
      let compressed = '';
      if (window.comprimirImagemCanvas) {
        compressed = await window.comprimirImagemCanvas(file, 600, 300, 0.6);
      } else {
        compressed = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              let w = img.width, h = img.height;
              const ratio = Math.min(600 / w, 300 / h, 1);
              w = Math.round(w * ratio);
              h = Math.round(h * ratio);
              const c = document.createElement('canvas');
              c.width = w; c.height = h;
              const ctx = c.getContext('2d');
              ctx.fillStyle = '#0b0a12';
              ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              resolve(c.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = () => resolve(ev.target.result);
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      bannerDataUrl = compressed;
      
      // Update UI preview
      bannerImagePreview.src = bannerDataUrl;
      bannerPreviewWrapper.style.display = 'block';
      
      // Update upload container message to show success
      const textEl = uploadContainer.querySelector('.upload-text');
      if (textEl) textEl.textContent = `Imagem selecionada: ${file.name} (Clique para alterar)`;
    } catch (err) {
      console.warn('Erro ao processar e comprimir banner:', err);
    }
  }

  // --- STEPPER TRANSITIONS ---
  function updateStepperUI() {
    // Calculate progress percentage
    const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;
    if (progressBar) progressBar.style.width = `${progressPercent}%`;

    // Toggle panels visibility
    Object.keys(panels).forEach(stepNum => {
      if (parseInt(stepNum) === currentStep) {
        panels[stepNum].classList.add('active');
      } else {
        panels[stepNum].classList.remove('active');
      }
    });

    // Toggle indicators styles
    Object.keys(indicators).forEach(stepNum => {
      const num = parseInt(stepNum);
      const ind = indicators[num];
      if (ind) {
        if (num === currentStep) {
          ind.classList.add('active');
          ind.classList.remove('completed');
        } else if (num < currentStep) {
          ind.classList.add('completed');
          ind.classList.remove('active');
        } else {
          ind.classList.remove('active', 'completed');
        }
      }
    });

    // Update buttons
    if (btnPrev) {
      if (currentStep === 1) {
        btnPrev.setAttribute('disabled', 'true');
      } else {
        btnPrev.removeAttribute('disabled');
      }
    }

    if (btnNext) {
      if (currentStep === totalSteps) {
        btnNext.innerHTML = '<span>Criar Torneio</span> <i class="fa-solid fa-trophy" style="margin-left: 6px;"></i>';
      } else {
        btnNext.innerHTML = '<span>Próximo</span> <i class="fa-solid fa-arrow-right" style="margin-left: 6px;"></i>';
      }
    }

    // Scroll to form card smoothly
    const formCard = document.querySelector('.torneio-form-card');
    if (formCard) {
      formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // --- STEP VALIDATION ENGINE ---
  function validateStep(step) {
    feedbackMsg.textContent = ''; // clear messages

    if (step === 1) {
      // Validate step 1 fields
      if (!nomeTorneio.value.trim()) {
        showValidationFeedback(nomeTorneio, 'Por favor, insira o nome do torneio.');
        return false;
      }
      if (!jogoNome.value.trim()) {
        showValidationFeedback(jogoNome, 'Por favor, informe o título do jogo.');
        return false;
      }
      if (!categoriaInput.value) {
        feedbackMsg.textContent = 'Por favor, selecione uma categoria de jogo.';
        feedbackMsg.style.color = '#ef4444';
        return false;
      }
      if (!plataformaInput.value) {
        feedbackMsg.textContent = 'Por favor, selecione a plataforma principal.';
        feedbackMsg.style.color = '#ef4444';
        return false;
      }
    } else if (step === 2) {
      // Validate step 2 fields
      if (!inicioData.value) {
        showValidationFeedback(inicioData, 'Por favor, selecione a data do torneio.');
        return false;
      }
      if (!inicioHora.value) {
        showValidationFeedback(inicioHora, 'Por favor, defina o horário de início.');
        return false;
      }
      if (tipoInscricaoSelect && tipoInscricaoSelect.value !== 'Apenas Solo (1v1)') {
        const maxVal = parseInt(maxIntegrantesInput.value, 10);
        if (isNaN(maxVal) || maxVal < 1) {
          showValidationFeedback(maxIntegrantesInput, 'Informe o número máximo de integrantes por equipe (mínimo 1).');
          return false;
        }
      }
      if (maxParticipantesInput) {
        const vagasVal = parseInt(maxParticipantesInput.value, 10);
        if (isNaN(vagasVal) || vagasVal < 2) {
          showValidationFeedback(maxParticipantesInput, 'Informe o número máximo de vagas (mínimo 2).');
          return false;
        }
      }
      if (modalidadeInput.value === 'presencial' && !localizacao.value.trim()) {
        showValidationFeedback(localizacao, 'Por favor, insira o endereço presencial do torneio.');
        return false;
      }
    } else if (step === 3) {
      // Validate final step before submission
      // Regras agora são opcionais com valor padrão automático
      if (taxaTipoInput.value === 'pago' && !taxaValor.value.trim()) {
        showValidationFeedback(taxaValor, 'Por favor, insira o valor cobrado para a inscrição.');
        return false;
      }
      if (tipoPremioInput.value !== 'nenhuma' && !premio1.value.trim()) {
        showValidationFeedback(premio1, 'Por favor, preencha o prêmio para o 1º colocado.');
        return false;
      }
    }

    return true;
  }

  function showValidationFeedback(inputElement, msg) {
    feedbackMsg.textContent = msg;
    feedbackMsg.style.color = '#ef4444'; // Red feedback
    
    // Smooth shake animation on the card
    const card = document.querySelector('.torneio-form-card');
    if (card) {
      card.style.transform = 'translateX(4px)';
      setTimeout(() => card.style.transform = 'translateX(-4px)', 80);
      setTimeout(() => card.style.transform = 'translateX(2px)', 160);
      setTimeout(() => card.style.transform = 'translateX(-2px)', 240);
      setTimeout(() => card.style.transform = 'none', 320);
    }

    if (inputElement) {
      inputElement.focus();
      inputElement.style.borderColor = '#ef4444';
      setTimeout(() => {
        inputElement.style.borderColor = '';
      }, 3000);
    }
  }

  // --- BUTTON EVENT LISTENERS ---
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
    });
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.tagName.toLowerCase() === 'input') {
        e.preventDefault();
        if (btnNext && !btnNext.disabled) {
          btnNext.click();
        }
      }
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateStepperUI();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (validateStep(currentStep)) {
        if (currentStep < totalSteps) {
          currentStep++;
          updateStepperUI();
        } else {
          // Final Submit!
          submitTournamentForm();
        }
      }
    });
  }

  // Allow clicking on previous or completed steps to jump directly
  const stepSteps = document.querySelectorAll('.step');
  stepSteps.forEach(stepEl => {
    stepEl.addEventListener('click', () => {
      const targetStep = parseInt(stepEl.getAttribute('data-step'));
      if (targetStep < currentStep) {
        // Can always go back
        currentStep = targetStep;
        updateStepperUI();
      } else if (targetStep > currentStep) {
        // Can only jump forward if previous steps validate
        let valid = true;
        for (let i = currentStep; i < targetStep; i++) {
          if (!validateStep(i)) {
            valid = false;
            break;
          }
        }
        if (valid) {
          currentStep = targetStep;
          updateStepperUI();
        }
      }
    });
  });

  // --- SAVE & REDIRECT SUBMIT LOGIC ---
  async function submitTournamentForm() {
    feedbackMsg.textContent = 'Verificando dados do organizador...';
    feedbackMsg.style.color = '#ffffff';

    if (btnNext) {
      btnNext.setAttribute('disabled', 'true');
      btnNext.innerHTML = '<span>Verificando...</span> <i class="fa-solid fa-circle-notch fa-spin" style="margin-left: 6px;"></i>';
    }

    const userObj = loggedUser || JSON.parse(localStorage.getItem('vh_loggedUser') || '{}');
    const userEmail = (userObj?.email || loggedUser?.email || '').toLowerCase().trim();

    // 1. Buscar primeiramente o nome cadastrado na tabela 'usuarios'
    let nomeOrganizador = '';
    try {
      const { data: usuarioPerfil, error: errPerfil } = await supabase
        .from('usuarios')
        .select('nome, email')
        .eq('email', userEmail)
        .maybeSingle();

      if (!errPerfil && usuarioPerfil && usuarioPerfil.nome && usuarioPerfil.nome.trim()) {
        nomeOrganizador = usuarioPerfil.nome.trim();
      }
    } catch (e) {
      console.warn('Aviso ao consultar nome do organizador na tabela usuarios:', e);
    }

    // Se o nome estiver em branco, solicita que o usuário preencha seu nome no perfil antes de criar o torneio
    if (!nomeOrganizador) {
      feedbackMsg.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px; color: #f59e0b;"></i> Por favor, <a href="/perfil/perfil.html" style="color: #60a5fa; text-decoration: underline; font-weight: 700;">preencha seu nome no perfil</a> antes de criar um torneio.';
      feedbackMsg.style.color = '#f59e0b';
      if (btnNext) {
        btnNext.removeAttribute('disabled');
        btnNext.innerHTML = '<span>Criar Torneio</span> <i class="fa-solid fa-trophy" style="margin-left: 6px;"></i>';
      }
      return;
    }

    if (userObj) {
      userObj.nome = nomeOrganizador;
      localStorage.setItem('vh_loggedUser', JSON.stringify(userObj));
    }

    feedbackMsg.textContent = 'Criando torneio...';

    // Formatar Categoria & Plataforma
    const catMap = {
      'fps': 'FPS / Tiro',
      'moba': 'MOBA',
      'battle-royale': 'Battle Royale',
      'esportes': 'Esportes'
    };
    const platMap = {
      'pc': 'PC',
      'console': 'Console',
      'mobile': 'Mobile',
      'multi': 'Multiplataforma'
    };

    const categoriaText = catMap[categoriaInput.value] || 'Geral';
    const plataformaText = platMap[plataformaInput.value] || 'Multiplataforma';
    const jogoDisplay = `${jogoNome.value.trim()} • ${categoriaText} • ${plataformaText}`;

    // Formatar data e horário para o card
    const dataValue = inicioData.value;
    const horaValue = inicioHora.value;
    let dataDisplay = '';

    if (dataValue && horaValue) {
      const [ano, mes, dia] = dataValue.split("-");
      const [horas, mins] = horaValue.split(":");
      dataDisplay = `Início: ${dia}/${mes}/${ano} às ${horas}h${mins !== "00" ? mins : ""}`;
    }

    // Status inicial obrigatório e fixo pela regra de negócio
    const statusText = 'Inscrições abertas';
    const statusClass = 'status-aberto';

    const id = 'custom-' + Date.now();
    const inicioIso = dataValue && horaValue ? `${dataValue}T${horaValue}` : '';
    const bannerFinal = bannerDataUrl || '/images/logo_versushub.png';
    const tipoSelecionado = tipoInscricaoSelect ? tipoInscricaoSelect.value : 'Apenas Solo (1v1)';

    // Objeto de dados estruturados
    const novoTorneio = {
      id,
      nome: nomeTorneio.value.trim(),
      jogo: jogoDisplay,
      data: dataDisplay,
      status: statusText,
      statusClass,
      banner: bannerFinal,
      criadorEmail: userObj ? userObj.email : '',

      descricao: descricao.value.trim(),
      categoria: categoriaInput.value,
      plataforma: plataformaInput.value,
      inicioIso,

      tipoInscricao: tipoSelecionado,
      tipo_inscricao: tipoSelecionado,
      formato: formatoTorneioInput ? formatoTorneioInput.value : 'Mata-Mata (Eliminatória)',
      formato_torneio: formatoTorneioInput ? formatoTorneioInput.value : 'Mata-Mata (Eliminatória)',
      maxIntegrantes: parseInt(maxIntegrantesInput ? maxIntegrantesInput.value : 5, 10) || 5,
      max_integrantes: parseInt(maxIntegrantesInput ? maxIntegrantesInput.value : 5, 10) || 5,
      maxParticipantes: parseInt(maxParticipantesInput ? maxParticipantesInput.value : 16, 10) || 16,
      max_participantes: parseInt(maxParticipantesInput ? maxParticipantesInput.value : 16, 10) || 16,
      limite: `${parseInt(maxParticipantesInput ? maxParticipantesInput.value : 16, 10) || 16} vagas`,

      localizacao: localizacao.value.trim(),
      modalidade: modalidadeInput.value,
      regras: (regras && regras.value.trim()) ? regras.value.trim() : 'Regras padrão da plataforma aplicáveis.',

      taxaTipo: taxaTipoInput.value,
      taxaValor: taxaTipoInput.value === 'pago' ? (taxaValor.value || '').trim() : '',

      tipoPremio: tipoPremioInput.value,
      premio1: premio1.value.trim(),
      premio2: premio2.value.trim(),
      premio3: premio3.value.trim(),
      premiacaoExtra: premiacaoExtra.value.trim(),

      requisitos: requisitos.value.trim(),
      link: '/torneio/custom.html?id=' + id
    };

    try {
      // 1. Inserir no Supabase (tabela torneios) com fallback resiliente de colunas
      let { data, error } = await supabase
        .from('torneios')
        .insert([novoTorneio])
        .select()
        .single();

      if (error) {
        console.warn('Tentativa inicial com payload completo falhou, testando payloads de compatibilidade:', error);
        // Garante que tipoInscricao e tipo_inscricao estejam presentes e NUNCA sejam removidos
        const payloadCamel = { ...novoTorneio };
        delete payloadCamel.max_integrantes;
        const resCamel = await supabase.from('torneios').insert([payloadCamel]).select().single();
        if (!resCamel.error) {
          error = null;
          data = resCamel.data;
        } else {
          const payloadSnake = { ...novoTorneio };
          delete payloadSnake.maxIntegrantes;
          const resSnake = await supabase.from('torneios').insert([payloadSnake]).select().single();
          if (!resSnake.error) {
            error = null;
            data = resSnake.data;
          } else {
            // Fallback seguro preservando tipoInscricao e tipo_inscricao selecionados pelo usuário
            const payloadBase = { ...novoTorneio };
            delete payloadBase.formato;
            delete payloadBase.formato_torneio;
            delete payloadBase.maxIntegrantes;
            delete payloadBase.max_integrantes;
            delete payloadBase.maxParticipantes;
            delete payloadBase.max_participantes;
            const resBase = await supabase.from('torneios').insert([payloadBase]).select().single();
            if (!resBase.error) {
              error = null;
              data = resBase.data;
            } else {
              error = resBase.error;
            }
          }
        }
      }

      if (error) {
        console.error('Erro ao inserir torneio no Supabase:', error);
        feedbackMsg.textContent = 'Erro ao salvar torneio: ' + (error.message || 'Tente novamente.');
        feedbackMsg.style.color = '#ef4444';
        if (btnNext) {
          btnNext.removeAttribute('disabled');
          btnNext.innerHTML = '<span>Criar Torneio</span> <i class="fa-solid fa-trophy" style="margin-left: 6px;"></i>';
        }
        return;
      }

      // 2. Sincronizar cache local para compatibilidade com as listagens existentes
      try {
        let lista = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        lista = lista.filter(t => t );
        lista.push(novoTorneio);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
      } catch (cacheErr) {
        console.warn('Cache local de torneios não atualizado:', cacheErr);
      }

      // Show beautiful success response and redirect
      feedbackMsg.innerHTML = '<i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> Torneio criado com sucesso! Redirecionando...';
      feedbackMsg.style.color = '#10b981'; // Green color

      setTimeout(() => {
        window.location.href = '/gerenciartorneios/gerentornindex.html';
      }, 1500);
    } catch (err) {
      console.error('Erro inesperado na criação do torneio:', err);
      feedbackMsg.textContent = 'Ocorreu um erro ao salvar o torneio.';
      feedbackMsg.style.color = '#ef4444';
      if (btnNext) {
        btnNext.removeAttribute('disabled');
        btnNext.innerHTML = '<span>Criar Torneio</span> <i class="fa-solid fa-trophy" style="margin-left: 6px;"></i>';
      }
    }
  }
});
