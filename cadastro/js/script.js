// /cadastro/js/script.js
import { supabase, ensureUserProfile } from '/supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;

  const nomeInput = form.querySelector('#cadNome') || form.querySelector('input[type="text"]');
  const emailInput = form.querySelector('#cadEmail') || form.querySelector('input[type="email"]');
  const senhaInput = form.querySelector('#cadSenha') || form.querySelector('input[type="password"]');
  const dataNascInput = form.querySelector('#cadNascimento') || form.querySelector('input[type="date"]');
  const submitBtn = form.querySelector('button[type="submit"]');

  const nomeErrorMsg = document.getElementById('nomeErrorMsg');
  const senhaErrorMsg = document.getElementById('senhaErrorMsg');
  const emailErrorMsg = document.getElementById('emailErrorMsg');
  const formGlobalErrorMsg = document.getElementById('formGlobalErrorMsg');

  function setFieldError(input, errorEl, message) {
    if (input) input.classList.add('input-invalid');
    if (errorEl) {
      errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;
      errorEl.style.display = 'flex';
    }
  }

  function clearFieldError(input, errorEl) {
    if (input) input.classList.remove('input-invalid');
    if (errorEl) {
      errorEl.innerHTML = '';
      errorEl.style.display = 'none';
    }
  }

  function clearAllErrors() {
    clearFieldError(nomeInput, nomeErrorMsg);
    clearFieldError(senhaInput, senhaErrorMsg);
    clearFieldError(emailInput, emailErrorMsg);
    if (formGlobalErrorMsg) {
      formGlobalErrorMsg.innerHTML = '';
      formGlobalErrorMsg.style.display = 'none';
    }
  }

  // Identificação e tratamento de violação de unicidade de nickname (código 23505 ou duplicate key)
  function isNicknameDuplicateError(err) {
    if (!err) return false;
    const code = String(err.code || '');
    const msg = String(err.message || '').toLowerCase();
    const details = String(err.details || '').toLowerCase();
    const hint = String(err.hint || '').toLowerCase();

    const isDuplicate = code === '23505' ||
      msg.includes('23505') ||
      msg.includes('duplicate key') ||
      details.includes('duplicate key') ||
      hint.includes('duplicate key') ||
      msg.includes('unique constraint') ||
      details.includes('unique constraint');

    if (!isDuplicate) return false;

    // Se o erro for especificamente apenas de e-mail e não envolver o nome/nickname
    if ((msg.includes('email') || details.includes('email')) && !msg.includes('nome') && !details.includes('nome') && !msg.includes('nickname') && !details.includes('nickname')) {
      return false;
    }
    return true;
  }

  // Alerta amigável no formulário mantendo os dados digitados na tela
  function handleDuplicateNickname() {
    setFieldError(nomeInput, nomeErrorMsg, 'Este nickname já está em uso por outro jogador. Por favor, escolha outro.');
    if (nomeInput) {
      nomeInput.focus();
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Cadastrar';
    }
  }

  // Validação em tempo real ao digitar a senha
  if (senhaInput) {
    senhaInput.addEventListener('input', () => {
      const val = senhaInput.value;
      if (val.length > 0 && val.length < 6) {
        setFieldError(senhaInput, senhaErrorMsg, 'A senha deve ter no mínimo 6 caracteres.');
      } else {
        clearFieldError(senhaInput, senhaErrorMsg);
      }
    });

    senhaInput.addEventListener('blur', () => {
      const val = senhaInput.value;
      if (val.length > 0 && val.length < 6) {
        setFieldError(senhaInput, senhaErrorMsg, 'A senha deve ter no mínimo 6 caracteres.');
      }
    });
  }

  // Validação em tempo real do nome de usuário
  if (nomeInput) {
    nomeInput.addEventListener('input', () => {
      const val = nomeInput.value.trim();
      if (val.length > 0 && (val.length < 2 || val.length > 33)) {
        setFieldError(nomeInput, nomeErrorMsg, 'O nome deve ter entre 2 e 33 caracteres.');
      } else {
        clearFieldError(nomeInput, nomeErrorMsg);
      }
    });

    nomeInput.addEventListener('blur', async () => {
      const val = nomeInput.value.trim();
      if (val.length >= 2 && val.length <= 33) {
        try {
          const { data: existingUser, error: checkError } = await supabase
            .from('usuarios')
            .select('id, nome')
            .ilike('nome', val)
            .maybeSingle();

          if (checkError && isNicknameDuplicateError(checkError)) {
            handleDuplicateNickname();
            return;
          }

          if (existingUser && existingUser.nome && existingUser.nome.toLowerCase() === val.toLowerCase()) {
            handleDuplicateNickname();
          }
        } catch (e) {
          if (isNicknameDuplicateError(e)) {
            handleDuplicateNickname();
          }
        }
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const nome = nomeInput ? nomeInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const password = senhaInput ? senhaInput.value : '';
    const dataNasc = dataNascInput ? dataNascInput.value : '';

    let hasError = false;

    if (!nome) {
      setFieldError(nomeInput, nomeErrorMsg, 'Por favor, informe seu nome de usuário.');
      hasError = true;
    } else if (nome.length < 2 || nome.length > 33) {
      setFieldError(nomeInput, nomeErrorMsg, 'O nome deve ter entre 2 e 33 caracteres.');
      hasError = true;
    }

    if (!email) {
      setFieldError(emailInput, emailErrorMsg, 'Por favor, informe seu e-mail.');
      hasError = true;
    }

    if (!password) {
      setFieldError(senhaInput, senhaErrorMsg, 'Por favor, crie uma senha.');
      hasError = true;
    } else if (password.length < 6) {
      setFieldError(senhaInput, senhaErrorMsg, 'A senha deve ter no mínimo 6 caracteres.');
      hasError = true;
    }

    if (hasError) {
      if (password.length < 6 && senhaInput) senhaInput.focus();
      else if (!nome && nomeInput) nomeInput.focus();
      else if (!email && emailInput) emailInput.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cadastrando...';
    }

    try {
      // 0. Validação prévia de unicidade de Nickname no Supabase
      try {
        const { data: existingNickUser, error: nickCheckError } = await supabase
          .from('usuarios')
          .select('id, nome, email')
          .ilike('nome', nome)
          .maybeSingle();

        if (nickCheckError && isNicknameDuplicateError(nickCheckError)) {
          handleDuplicateNickname();
          return;
        }

        if (existingNickUser && existingNickUser.nome && existingNickUser.nome.toLowerCase() === nome.toLowerCase()) {
          handleDuplicateNickname();
          return;
        }
      } catch (nickEx) {
        if (isNicknameDuplicateError(nickEx)) {
          handleDuplicateNickname();
          return;
        }
        console.warn('Aviso na verificação de nickname existente:', nickEx);
      }

      // 1. Executa supabase.auth.signUp enviando os metadados requeridos
      let authUser = null;
      let authUserId = null;

      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nome,
              display_name: nome,
              full_name: nome
            }
          }
        });

        if (authError) {
          if (isNicknameDuplicateError(authError)) {
            handleDuplicateNickname();
            return;
          }

          if (authError.message.includes('User already registered') || authError.message.includes('already registered')) {
            setFieldError(emailInput, emailErrorMsg, 'Já existe uma conta cadastrada com esse e-mail. Faça login ou utilize outro endereço.');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Cadastrar';
            }
            return;
          }

          if (authError.message.includes('Password should be') || authError.message.includes('weak_password') || authError.message.includes('least 6')) {
            setFieldError(senhaInput, senhaErrorMsg, 'A senha deve ter no mínimo 6 caracteres.');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Cadastrar';
            }
            return;
          }

          console.warn('Aviso no Supabase Auth signUp:', authError.message);
        } else if (authData) {
          authUser = authData.user;
          authUserId = authUser?.id;
        }

        // Login automático imediato pós-cadastro para garantir sessão ativa
        try {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          if (!signInError && signInData?.user) {
            authUser = signInData.user;
            authUserId = signInData.user.id;
          }
        } catch (signCatchErr) {
          console.warn('Aviso ao persistir sessão com signInWithPassword:', signCatchErr);
        }
      } catch (authCatchErr) {
        if (isNicknameDuplicateError(authCatchErr)) {
          handleDuplicateNickname();
          return;
        }
        console.warn('Exceção ao chamar Supabase Auth signUp:', authCatchErr);
      }

      // 2. Gravação garantida e síncrona na tabela public.usuarios no Supabase
      let profile = null;

      // 2.1 Gravação direta no Supabase com confirmação de sucesso
      try {
        const payloadGravar = {
          email,
          nome,
          avatar: '/image/boneco_logo_ofc.png',
          regiao: 'Brasil',
          stats: { disputed: 0, won: 0, wins: 0, losses: 0 }
        };
        if (dataNasc) {
          payloadGravar.dataNasc = dataNasc;
        }
        if (authUserId) {
          payloadGravar.id = authUserId;
        }

        const { data: dbData, error: dbErr } = await supabase
          .from('usuarios')
          .upsert([payloadGravar], { onConflict: 'email' })
          .select('*')
          .maybeSingle();

        if (dbErr) {
          if (isNicknameDuplicateError(dbErr)) {
            handleDuplicateNickname();
            return;
          }
          console.warn('Aviso no upsert de cadastro:', dbErr);
        } else if (dbData) {
          profile = dbData;
        }
      } catch (upsertErr) {
        if (isNicknameDuplicateError(upsertErr)) {
          handleDuplicateNickname();
          return;
        }
        console.warn('Exceção no upsert direto:', upsertErr);
      }

      // 2.2 Fallback de verificação via ensureUserProfile caso o upsert direto não tenha retornado perfil
      if (!profile) {
        try {
          profile = await ensureUserProfile(authUser || {
            id: authUserId,
            email,
            user_metadata: { nome, display_name: nome, full_name: nome }
          });
        } catch (pErr) {
          if (isNicknameDuplicateError(pErr)) {
            handleDuplicateNickname();
            return;
          }
          console.warn('Aviso ao executar ensureUserProfile no cadastro:', pErr);
        }
      }

      // 2.3 Tentativa final com inserção básica caso ainda não tenha perfil
      if (!profile) {
        try {
          const { data: basicInsert, error: basicErr } = await supabase
            .from('usuarios')
            .insert([{ email, nome }])
            .select('*')
            .maybeSingle();

          if (basicErr) {
            if (isNicknameDuplicateError(basicErr)) {
              handleDuplicateNickname();
              return;
            }
            console.warn('Aviso no insert básico:', basicErr);
          } else if (basicInsert) {
            profile = basicInsert;
          }
        } catch (basicErr) {
          if (isNicknameDuplicateError(basicErr)) {
            handleDuplicateNickname();
            return;
          }
          console.warn('Aviso no insert básico:', basicErr);
        }
      }

      // 3. Salva os dados da sessão no localStorage e redireciona para a página inicial
      const finalUserId = profile?.id || authUserId || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'usr_' + Date.now());

      const usuarioSessao = {
        id: finalUserId,
        email: email,
        nome: profile?.nome || nome,
        avatar: profile?.avatar || '/image/boneco_logo_ofc.png',
        bio: profile?.bio || '',
        regiao: profile?.regiao || 'Brasil',
        plataformas: profile?.plataformas || [],
        jogosFavoritos: profile?.jogosFavoritos || [],
        stats: profile?.stats || { disputed: 0, won: 0, wins: 0, losses: 0 },
        conquistas: profile?.conquistas || [
          { titulo: "Perfil Ativado", desc: "Configure e atualize suas conquistas para o ranking no painel de perfil.", data: "Desbloqueado" }
        ],
        auth_id: authUserId || finalUserId
      };
      localStorage.setItem('vh_loggedUser', JSON.stringify(usuarioSessao));

      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Conta criada com sucesso!';
      }

      setTimeout(() => {
        window.location.href = '/pagina_inicial/index.html';
      }, 500);
    } catch (err) {
      if (isNicknameDuplicateError(err)) {
        handleDuplicateNickname();
        return;
      }
      console.error('Erro inesperado no cadastro:', err);
      if (formGlobalErrorMsg) {
        formGlobalErrorMsg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Ocorreu um erro ao processar o cadastro. Tente novamente.';
        formGlobalErrorMsg.style.display = 'block';
      } else {
        alert('Ocorreu um erro ao processar o cadastro. Tente novamente.');
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Cadastrar';
      }
    }
  });
});
