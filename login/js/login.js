// /login/js/login.js
import { supabase } from '/supabaseClient.js';

document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.getElementById("formLogin");
    const loginMessage = document.getElementById("loginMessage");
    const loginEmailInput = document.getElementById("loginEmail");
    const loginSenhaInput = document.getElementById("loginSenha");

    if (!formLogin || !loginMessage) return;

    // Processamento assíncrono do formulário de login com Supabase
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Limpar mensagens e classes anteriores
        loginMessage.textContent = "";
        loginMessage.className = "login-feedback";

        const email = loginEmailInput.value.trim().toLowerCase();
        const senha = loginSenhaInput.value;

        if (!email || !senha) {
            showMessage("Por favor, preencha todos os campos.", "error");
            return;
        }

        const submitBtn = formLogin.querySelector("button[type='submit']");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Verificando...";
        }

        try {
            // 1. Buscar usuário na tabela 'usuarios' do Supabase
            const { data: userEncontrado, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (error) {
                console.error("Erro ao buscar usuário no Supabase:", error);
                showMessage("Erro de conexão. Tente novamente mais tarde.", "error");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Entrar";
                }
                return;
            }

            if (!userEncontrado) {
                showMessage("E-mail não cadastrado. Verifique ou cadastre-se!", "error");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Entrar";
                }
                return;
            }

            // 2. Validar senha correspondente
            if (userEncontrado.senha !== senha) {
                showMessage("Senha incorreta. Tente novamente.", "error");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Entrar";
                }
                return;
            }

            // 3. Login validado com sucesso!
            showMessage(`Bem-vindo, ${userEncontrado.nome}! Entrando...`, "success");

            // Guardar usuário ativo localmente para gerenciar a sessão na navegação
            localStorage.setItem("vh_loggedUser", JSON.stringify(userEncontrado));

            // Desabilitar inputs para evitar cliques múltiplos
            loginEmailInput.disabled = true;
            loginSenhaInput.disabled = true;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = "0.5";
                submitBtn.textContent = "Entrando...";
            }

            // Redirecionamento após 1.5 segundos
            setTimeout(() => {
                window.location.href = "/pagina_inicial/index.html";
            }, 1500);
        } catch (err) {
            console.error("Erro no fluxo de login:", err);
            showMessage("Ocorreu um erro ao realizar login.", "error");
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

