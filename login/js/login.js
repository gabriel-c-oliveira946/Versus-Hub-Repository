// /login/js/login.js
import { supabase } from '/supabaseClient.js';

document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.getElementById("formLogin");
    const loginMessage = document.getElementById("loginMessage");
    const loginEmailInput = document.getElementById("loginEmail");
    const loginSenhaInput = document.getElementById("loginSenha");

    if (!formLogin || !loginMessage) return;

    // Processamento assíncrono do formulário de login com Supabase Auth nativo
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Limpar mensagens e classes anteriores
        loginMessage.textContent = "";
        loginMessage.className = "login-feedback";

        const email = loginEmailInput.value.trim().toLowerCase();
        const password = loginSenhaInput.value;

        if (!email || !password) {
            showMessage("Por favor, preencha todos os campos.", "error");
            return;
        }

        if (password.length < 6) {
            showMessage("A senha deve ter no mínimo 6 caracteres.", "error");
            loginSenhaInput.focus();
            return;
        }

        const submitBtn = formLogin.querySelector("button[type='submit']");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Verificando credenciais...';
        }

        try {
            // 1. Autenticação nativa com Supabase Auth (sem consultar senhas em texto puro)
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                console.error("Erro no Supabase Auth signInWithPassword:", authError);
                let msg = "E-mail ou senha incorretos. Verifique suas credenciais.";
                if (authError.message.includes("Invalid login credentials") || authError.message.includes("invalid_grant")) {
                    msg = "Credenciais inválidas. Verifique seu e-mail e senha.";
                } else if (authError.message.includes("Email not confirmed")) {
                    msg = "E-mail ainda não confirmado. Verifique sua caixa de entrada para confirmar sua conta.";
                } else if (authError.message) {
                    msg = authError.message;
                }
                showMessage(msg, "error");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Entrar";
                }
                return;
            }

            const authUser = authData?.user;
            if (!authUser) {
                showMessage("Não foi possível iniciar a sessão. Tente novamente.", "error");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Entrar";
                }
                return;
            }

            // 2. Buscar perfil correspondente na tabela 'usuarios' (sem expor a coluna senha)
            let profile = null;
            try {
                const { data: userProfile, error: profileErr } = await supabase
                    .from('usuarios')
                    .select('id, nome, email, "dataNasc", bio, avatar, regiao, "jogosFavoritos", plataformas, banner, stats, conquistas')
                    .eq('email', email)
                    .maybeSingle();

                if (!profileErr && userProfile) {
                    profile = userProfile;
                }
            } catch (pErr) {
                console.warn("Aviso ao carregar perfil do banco:", pErr);
            }

            const nomeFinal = profile?.nome || authUser.user_metadata?.nome || email.split('@')[0];
            const usuarioSessao = {
                id: profile?.id || authUser.id,
                nome: nomeFinal,
                email: email,
                avatar: profile?.avatar || '/image/boneco_logo_ofc.png',
                banner: profile?.banner || '',
                bio: profile?.bio || '',
                regiao: profile?.regiao || 'Brasil',
                plataformas: profile?.plataformas || [],
                jogosFavoritos: profile?.jogosFavoritos || [],
                stats: profile?.stats || { disputed: 0, won: 0, wins: 0, losses: 0 },
                conquistas: profile?.conquistas || [],
                auth_id: authUser.id
            };

            // Se o perfil ainda não existe na tabela 'usuarios', provisiona automaticamente
            if (!profile) {
                try {
                    await supabase.from('usuarios').insert([{
                        id: authUser.id,
                        nome: nomeFinal,
                        email: email,
                        dataNasc: authUser.user_metadata?.dataNasc || null,
                        bio: '',
                        avatar: '/image/boneco_logo_ofc.png',
                        stats: { disputed: 0, won: 0, wins: 0, losses: 0 },
                        conquistas: []
                    }]);
                } catch (insErr) {
                    console.warn("Aviso ao sincronizar perfil novo:", insErr);
                }
            }

            // 3. Login validado com sucesso!
            showMessage(`Bem-vindo, ${nomeFinal}! Entrando...`, "success");

            // Guardar usuário ativo localmente para inicialização síncrona imediata
            localStorage.setItem("vh_loggedUser", JSON.stringify(usuarioSessao));

            // Desabilitar inputs para evitar duplo clique
            loginEmailInput.disabled = true;
            loginSenhaInput.disabled = true;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = "0.7";
                submitBtn.innerHTML = '<i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> Entrando...';
            }

            // Redirecionamento rápido
            setTimeout(() => {
                window.location.href = "/pagina_inicial/index.html";
            }, 1000);
        } catch (err) {
            console.error("Erro no fluxo de login:", err);
            showMessage("Ocorreu um erro ao realizar login. Tente novamente.", "error");
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Entrar";
            }
        }
    });

    // Função auxiliar para exibir as mensagens na tela
    function showMessage(text, type) {
        loginMessage.textContent = text;
        if (type === "success") {
            loginMessage.className = "login-feedback success";
        } else if (type === "error") {
            loginMessage.className = "login-feedback error";
        }
    }
});
