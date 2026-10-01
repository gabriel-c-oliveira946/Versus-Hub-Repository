// /cadastro/js/script.js
import { supabase } from '/supabaseClient.js';

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
      // 1. Cadastro com Supabase Auth nativo
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome,
            dataNasc: dataNasc || null
          }
        }
      });

      if (authError) {
        console.error('Erro no Supabase Auth signUp:', authError);
        let msg = 'Erro ao realizar cadastro: ' + authError.message;
        if (authError.message.includes('User already registered') || authError.message.includes('already registered')) {
          msg = 'Já existe uma conta cadastrada com esse e-mail. Faça login ou utilize outro endereço.';
          setFieldError(emailInput, emailErrorMsg, msg);
        } else if (authError.message.includes('Password should be') || authError.message.includes('weak_password') || authError.message.includes('least 6')) {
          msg = 'A senha deve ter no mínimo 6 caracteres.';
          setFieldError(senhaInput, senhaErrorMsg, msg);
        } else if (formGlobalErrorMsg) {
          formGlobalErrorMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}`;
          formGlobalErrorMsg.style.display = 'block';
        } else {
          alert(msg);
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Cadastrar';
        }
        return;
      }

      const authUser = authData?.user;
      const authUserId = authUser?.id;

      // 2. Criar ou sincronizar o perfil público do usuário na tabela 'usuarios'
      const novoPerfil = {
        id: authUserId || undefined,
        nome,
        email,
        dataNasc: dataNasc || null,
        bio: '',
        avatar: '/image/boneco_logo_ofc.png',
        stats: { disputed: 0, won: 0, wins: 0, losses: 0 },
        conquistas: [
          { titulo: "Perfil Ativado", desc: "Configure e atualize suas conquistas para o ranking no painel de perfil.", data: "Desbloqueado" }
        ]
      };

      try {
        const { error: insertError } = await supabase
          .from('usuarios')
          .insert([novoPerfil]);

        if (insertError) {
          console.warn('Aviso ao registrar perfil na tabela usuarios:', insertError);
          const perfilSemId = { ...novoPerfil };
          delete perfilSemId.id;
          await supabase.from('usuarios').insert([perfilSemId]);
        }
      } catch (errPerfil) {
        console.warn('Aviso na inserção de perfil:', errPerfil);
      }

      // 3. Montar sessão local para acesso imediato
      const usuarioSessao = {
        ...novoPerfil,
        id: authUserId || novoPerfil.id,
        auth_id: authUserId
      };
      localStorage.setItem('vh_loggedUser', JSON.stringify(usuarioSessao));

      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Conta criada com sucesso!';
      }

      setTimeout(() => {
        window.location.href = '/pagina_inicial/index.html';
      }, 700);
    } catch (err) {
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

