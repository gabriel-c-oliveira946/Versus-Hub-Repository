// /cadastro/js/script.js
import { supabase } from '/supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nomeInput = form.querySelector('#cadNome') || form.querySelector('input[type="text"]');
    const emailInput = form.querySelector('#cadEmail') || form.querySelector('input[type="email"]');
    const senhaInput = form.querySelector('#cadSenha') || form.querySelector('input[type="password"]');
    const dataNascInput = form.querySelector('#cadNascimento') || form.querySelector('input[type="date"]');
    const submitBtn = form.querySelector('button[type="submit"]');

    const nome = nomeInput ? nomeInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const senha = senhaInput ? senhaInput.value : '';
    const dataNasc = dataNascInput ? dataNascInput.value : '';

    if (!nome || !email || !senha) {
      alert('Preencha nome, e-mail e senha.');
      return;
    }

    if (nome.length < 2 || nome.length > 33) {
      alert('O nome de usuário deve ter no mínimo 2 e no máximo 33 caracteres.');
      if (nomeInput) nomeInput.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Cadastrando...';
    }

    try {
      // 1. Verificar se o e-mail já existe na tabela 'usuarios' do Supabase
      const { data: existente, error: checkError } = await supabase
        .from('usuarios')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      if (checkError) {
        console.error('Erro ao consultar usuário no Supabase:', checkError);
      }

      if (existente) {
        alert('Já existe uma conta cadastrada com esse e-mail.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Cadastrar';
        }
        return;
      }

      // 2. Montar o payload do novo usuário com pontuações zeradas e sem equipe
      const novoUsuario = {
        nome,
        email,
        senha,
        dataNasc: dataNasc || null,
        bio: '',
        avatar: '/image/boneco_logo_ofc.png',
        stats: { disputed: 0, won: 0, wins: 0, losses: 0 },
        conquistas: []
      };

      // 3. Inserir no Supabase
      const { data: usuarioCriado, error: insertError } = await supabase
        .from('usuarios')
        .insert([novoUsuario])
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao inserir usuário no Supabase:', insertError);
        alert('Erro ao realizar cadastro: ' + (insertError.message || 'Tente novamente.'));
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Cadastrar';
        }
        return;
      }

      // Salvar a sessão do usuário logado localmente para navegação da aplicação
      const usuarioSessao = usuarioCriado || novoUsuario;
      localStorage.setItem('vh_loggedUser', JSON.stringify(usuarioSessao));

      alert('Cadastro realizado com sucesso!');
      window.location.href = '/pagina_inicial/index.html';
    } catch (err) {
      console.error('Erro inesperado no cadastro:', err);
      alert('Ocorreu um erro ao processar o cadastro.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Cadastrar';
      }
    }
  });
});


