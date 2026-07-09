// /criar_torneio/js/criar.js
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'vh_createdTournaments';

  // --- LOGIN VERIFICATION ---
  const loggedUserRaw = localStorage.getItem("vh_loggedUser");
  if (!loggedUserRaw) {
    const container = document.querySelector('.criar-torneio-page');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: #141419; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.08); max-width: 600px; margin: 80px auto; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <span style="font-size: 64px; display: block; margin-bottom: 20px;">🔒</span>
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
  const descricao = document.getElementById('descricao');
  const localizacao = document.getElementById('localizacao');
  const requisitos = document.getElementById('requisitos');
  const regras = document.getElementById('regras');
  const taxaValor = document.getElementById('taxaValor');

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

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      bannerDataUrl = ev.target.result;
      
      // Update UI preview
      bannerImagePreview.src = bannerDataUrl;
      bannerPreviewWrapper.style.display = 'block';
      
      // Update upload container message to show success
      const textEl = uploadContainer.querySelector('.upload-text');
      if (textEl) textEl.textContent = `Imagem selecionada: ${file.name} (Clique para alterar)`;
    };
    reader.readAsDataURL(file);
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
        btnNext.innerHTML = '<span>Criar Torneio</span> 🏆';
      } else {
        btnNext.innerHTML = '<span>Próximo</span> ➜';
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
      if (modalidadeInput.value === 'presencial' && !localizacao.value.trim()) {
        showValidationFeedback(localizacao, 'Por favor, insira o endereço presencial do torneio.');
        return false;
      }
    } else if (step === 3) {
      // Validate final step before submission
      if (!regras.value.trim()) {
        showValidationFeedback(regras, 'Por favor, insira o regulamento ou regras principais.');
        return false;
      }
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
  function submitTournamentForm() {
    feedbackMsg.textContent = 'Processando criação do torneio...';
    feedbackMsg.style.color = '#ffffff';

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

    // Status classes
    let statusText = '';
    let statusClass = '';
    switch (statusSelect.value) {
      case 'aberto':
        statusText = 'Inscrições abertas';
        statusClass = 'status-aberto';
        break;
      case 'andamento':
        statusText = 'Em andamento';
        statusClass = 'status-andamento';
        break;
      case 'encerrado':
        statusText = 'Encerrado';
        statusClass = 'status-encerrado';
        break;
      default:
        statusText = 'Inscrições abertas';
        statusClass = 'status-aberto';
    }

    const id = 'custom-' + Date.now();
    const inicioIso = dataValue && horaValue ? `${dataValue}T${horaValue}` : '';
    const bannerFinal = bannerDataUrl || '/images/cerradocup.jpg';

    // Objeto de dados estruturados
    const userObj = JSON.parse(loggedUserRaw);
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

      localizacao: localizacao.value.trim(),
      modalidade: modalidadeInput.value,
      regras: regras.value.trim(),

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

    // Salvar no localStorage
    let lista = [];
    try {
      lista = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      lista = [];
    }
    
    lista.push(novoTorneio);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));

    // Show beautiful success response and redirect
    feedbackMsg.textContent = '🏆 Torneio criado com sucesso! Redirecionando...';
    feedbackMsg.style.color = '#10b981'; // Green color

    setTimeout(() => {
      window.location.href = '/gerenciartorneios/gerentornindex.html';
    }, 1500);
  }
});
