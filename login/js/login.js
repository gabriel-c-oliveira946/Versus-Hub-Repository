// /login/js/login.js
import { supabase, ensureUserProfile } from '/supabaseClient.js';

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
                console.warn("Aviso na autenticação com Supabase:", authError.message || authError);
                let msg = "E-mail ou senha incorretos. Verifique suas credenciais.";
                if (authError.message && (authError.message.includes("Invalid login credentials") || authError.message.includes("invalid_grant"))) {
                    msg = "E-mail ou senha incorretos. Verifique os dados digitados.";
                } else if (authError.message && authError.message.includes("Email not confirmed")) {
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

            // 2. Garantir e buscar perfil na tabela 'usuarios' via ensureUserProfile
            let profile = null;
            try {
                profile = await ensureUserProfile(authUser);
            } catch (pErr) {
                console.warn("Aviso ao garantir perfil do usuário no banco:", pErr);
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

    // ==========================================
    // RECUPERAÇÃO DE SENHA COM SUPABASE AUTH
    // ==========================================
    const btnEsqueciSenha = document.getElementById("btnEsqueciSenha");
    if (btnEsqueciSenha) {
        btnEsqueciSenha.addEventListener("click", (e) => {
            e.preventDefault();
            abrirModalRecuperarSenha();
        });
    }

    function abrirModalRecuperarSenha() {
        let modal = document.getElementById("modalEsqueciSenha");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "modalEsqueciSenha";
            modal.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 20px;";
            document.body.appendChild(modal);
        }

        const prefillEmail = loginEmailInput ? loginEmailInput.value.trim() : "";

        modal.innerHTML = `
            <div style="background: #111118; border: 1px solid #28283a; border-radius: 18px; width: 100%; max-width: 440px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); overflow: hidden; text-align: left; animation: modalPop 0.25s ease;">
                <div style="padding: 18px 24px; border-bottom: 1px solid #232332; display: flex; justify-content: space-between; align-items: center; background: #161622;">
                    <h3 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-key" style="color: #38bdf8;"></i> Recuperar Senha
                    </h3>
                    <button type="button" id="btnFecharModalEsqueci" style="background: none; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; padding: 4px;">&times;</button>
                </div>
                <form id="formEsqueciSenha" style="padding: 22px 24px;">
                    <p style="color: #9ca3af; font-size: 13.5px; margin-top: 0; margin-bottom: 16px; line-height: 1.5;">
                        Digite o e-mail cadastrado na sua conta do VersusHub para receber o link de redefinição de senha:
                    </p>
                    <div id="msgRecuperarSenha" style="display: none; padding: 12px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; line-height: 1.4;"></div>
                    <div style="margin-bottom: 18px;">
                        <input
                            type="email"
                            id="inputEmailRecuperar"
                            placeholder="seuemail@exemplo.com"
                            value="${escapeHtml(prefillEmail)}"
                            required
                            style="width: 100%; box-sizing: border-box; padding: 12px 14px; background: #161622; border: 1px solid #2a2a3c; border-radius: 10px; color: #ffffff; font-size: 14px; outline: none; transition: border-color 0.2s;"
                        />
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" id="btnCancelarEsqueci" style="background: transparent; border: 1px solid #2a2a3c; color: #9ca3af; padding: 10px 18px; border-radius: 8px; font-size: 13.5px; font-weight: 600; cursor: pointer;">
                            Cancelar
                        </button>
                        <button type="submit" id="btnEnviarEmailRecuperar" style="background: linear-gradient(135deg, #0284c7 0%, #38bdf8 100%); border: none; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-size: 13.5px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);">
                            Enviar Link
                        </button>
                    </div>
                </form>
            </div>
        `;

        modal.style.display = "flex";

        const btnFechar = document.getElementById("btnFecharModalEsqueci");
        const btnCancelar = document.getElementById("btnCancelarEsqueci");
        const formEsqueci = document.getElementById("formEsqueciSenha");
        const inputEmail = document.getElementById("inputEmailRecuperar");
        const msgRec = document.getElementById("msgRecuperarSenha");
        const btnEnviar = document.getElementById("btnEnviarEmailRecuperar");

        const fechar = () => { modal.style.display = "none"; };
        btnFechar.onclick = fechar;
        btnCancelar.onclick = fechar;
        modal.onclick = (e) => { if (e.target === modal) fechar(); };

        inputEmail.focus();

        formEsqueci.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            const email = inputEmail.value.trim().toLowerCase();
            if (!email) return;

            btnEnviar.disabled = true;
            btnEnviar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
            msgRec.style.display = "none";

            try {
                const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/login/login.html`
                });

                if (error) {
                    console.warn("Aviso ao solicitar redefinição de senha:", error?.message || error);
                    msgRec.style.display = "block";
                    msgRec.style.background = "rgba(239, 68, 68, 0.15)";
                    msgRec.style.border = "1px solid #ef4444";
                    msgRec.style.color = "#fca5a5";
                    msgRec.textContent = error.message || "Erro ao enviar e-mail de redefinição. Verifique o e-mail digitado.";
                    btnEnviar.disabled = false;
                    btnEnviar.textContent = "Enviar Link";
                    return;
                }

                msgRec.style.display = "block";
                msgRec.style.background = "rgba(16, 185, 129, 0.15)";
                msgRec.style.border = "1px solid #10b981";
                msgRec.style.color = "#6ee7b7";
                msgRec.innerHTML = '<i class="fa-solid fa-circle-check"></i> E-mail de redefinição enviado com sucesso! Verifique sua caixa de entrada e spam.';

                btnEnviar.style.display = "none";
                btnCancelar.textContent = "Fechar";

                // Atualiza também mensagem principal na tela de login
                showMessage("E-mail de redefinição enviado com sucesso! Verifique sua caixa de entrada.", "success");

                setTimeout(() => {
                    fechar();
                }, 3500);
            } catch (err) {
                console.warn("Exceção ao solicitar redefinição:", err?.message || err);
                msgRec.style.display = "block";
                msgRec.style.background = "rgba(239, 68, 68, 0.15)";
                msgRec.style.border = "1px solid #ef4444";
                msgRec.style.color = "#fca5a5";
                msgRec.textContent = "Ocorreu um erro inesperado ao enviar o e-mail.";
                btnEnviar.disabled = false;
                btnEnviar.textContent = "Enviar Link";
            }
        });
    }

    // ==========================================
    // MODAL DE NOVA SENHA (PASSWORD_RECOVERY)
    // ==========================================
    function abrirModalNovaSenha() {
        let modal = document.getElementById("modalNovaSenhaRecuperacao");
        if (modal && modal.style.display === "flex") {
            return;
        }
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "modalNovaSenhaRecuperacao";
            modal.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(6px); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 20px;";
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background: #111118; border: 1px solid #28283a; border-radius: 18px; width: 100%; max-width: 440px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); overflow: hidden; text-align: left; animation: modalPop 0.25s ease;">
                <div style="padding: 18px 24px; border-bottom: 1px solid #232332; display: flex; justify-content: space-between; align-items: center; background: #161622;">
                    <h3 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                        <i class="fa-solid fa-lock" style="color: #38bdf8;"></i> Redefinir Senha
                    </h3>
                    <button type="button" id="btnFecharModalNovaSenha" style="background: none; border: none; color: #9ca3af; font-size: 20px; cursor: pointer; padding: 4px;">&times;</button>
                </div>
                <form id="formSalvarNovaSenha" style="padding: 22px 24px;">
                    <p style="color: #9ca3af; font-size: 13.5px; margin-top: 0; margin-bottom: 16px; line-height: 1.5;">
                        Digite sua nova senha abaixo para redefinir o acesso à sua conta:
                    </p>
                    <div id="msgNovaSenhaStatus" style="display: none; padding: 12px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; line-height: 1.4;"></div>
                    <div style="margin-bottom: 14px;">
                        <label style="display: block; color: #cbd5e1; font-size: 13px; font-weight: 600; margin-bottom: 6px;">Nova Senha</label>
                        <input
                            type="password"
                            id="inputNovaSenhaVal"
                            placeholder="Mínimo 6 caracteres"
                            minlength="6"
                            required
                            style="width: 100%; box-sizing: border-box; padding: 12px 14px; background: #161622; border: 1px solid #2a2a3c; border-radius: 10px; color: #ffffff; font-size: 14px; outline: none; transition: border-color 0.2s;"
                        />
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; color: #cbd5e1; font-size: 13px; font-weight: 600; margin-bottom: 6px;">Confirme a Nova Senha</label>
                        <input
                            type="password"
                            id="inputConfirmarNovaSenhaVal"
                            placeholder="Repita a nova senha"
                            minlength="6"
                            required
                            style="width: 100%; box-sizing: border-box; padding: 12px 14px; background: #161622; border: 1px solid #2a2a3c; border-radius: 10px; color: #ffffff; font-size: 14px; outline: none; transition: border-color 0.2s;"
                        />
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" id="btnCancelarNovaSenha" style="background: transparent; border: 1px solid #2a2a3c; color: #9ca3af; padding: 10px 18px; border-radius: 8px; font-size: 13.5px; font-weight: 600; cursor: pointer;">
                            Cancelar
                        </button>
                        <button type="submit" id="btnConfirmarNovaSenha" style="background: linear-gradient(135deg, #0284c7 0%, #38bdf8 100%); border: none; color: #ffffff; padding: 10px 20px; border-radius: 8px; font-size: 13.5px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);">
                            Salvar Nova Senha
                        </button>
                    </div>
                </form>
            </div>
        `;

        modal.style.display = "flex";

        const fechar = () => { modal.style.display = "none"; };
        const btnFechar = modal.querySelector("#btnFecharModalNovaSenha");
        const btnCancelar = modal.querySelector("#btnCancelarNovaSenha");
        const formSalvar = modal.querySelector("#formSalvarNovaSenha");
        const inputPass = modal.querySelector("#inputNovaSenhaVal");
        const inputConf = modal.querySelector("#inputConfirmarNovaSenhaVal");
        const msgStatus = modal.querySelector("#msgNovaSenhaStatus");
        const btnConfirmar = modal.querySelector("#btnConfirmarNovaSenha");

        btnFechar.onclick = fechar;
        btnCancelar.onclick = fechar;
        modal.onclick = (e) => { if (e.target === modal) fechar(); };

        inputPass.focus();

        formSalvar.addEventListener("submit", async (e) => {
            e.preventDefault();
            const novaSenha = inputPass.value;
            const confirmacao = inputConf.value;

            if (!novaSenha || novaSenha.length < 6) {
                msgStatus.style.display = "block";
                msgStatus.style.background = "rgba(239, 68, 68, 0.15)";
                msgStatus.style.border = "1px solid #ef4444";
                msgStatus.style.color = "#fca5a5";
                msgStatus.textContent = "A senha deve ter no mínimo 6 caracteres.";
                inputPass.focus();
                return;
            }

            if (novaSenha !== confirmacao) {
                msgStatus.style.display = "block";
                msgStatus.style.background = "rgba(239, 68, 68, 0.15)";
                msgStatus.style.border = "1px solid #ef4444";
                msgStatus.style.color = "#fca5a5";
                msgStatus.textContent = "As senhas digitadas não coincidem.";
                inputConf.focus();
                return;
            }

            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Atualizando...';

            try {
                // Ao salvar a nova senha, executa APENAS supabase.auth.updateUser({ password: novaSenha })
                const { data, error } = await supabase.auth.updateUser({
                    password: novaSenha
                });

                if (error) {
                    console.warn("Aviso ao atualizar senha:", error?.message || error);
                    msgStatus.style.display = "block";
                    msgStatus.style.background = "rgba(239, 68, 68, 0.15)";
                    msgStatus.style.border = "1px solid #ef4444";
                    msgStatus.style.color = "#fca5a5";
                    msgStatus.textContent = error.message || "Erro ao atualizar senha. O link pode ter expirado.";
                    btnConfirmar.disabled = false;
                    btnConfirmar.textContent = "Salvar Nova Senha";
                    return;
                }

                msgStatus.style.display = "block";
                msgStatus.style.background = "rgba(16, 185, 129, 0.15)";
                msgStatus.style.border = "1px solid #10b981";
                msgStatus.style.color = "#6ee7b7";
                msgStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> Senha atualizada com sucesso! Você já pode entrar.';

                btnConfirmar.style.display = "none";
                btnCancelar.textContent = "Fechar";

                // Limpa fragmentos de recuperação da URL
                try {
                    if (window.history && window.history.replaceState) {
                        window.history.replaceState(null, '', window.location.pathname);
                    }
                } catch (hErr) {}

                showMessage("Senha redefinida com sucesso! Digite sua nova senha para entrar.", "success");

                setTimeout(() => {
                    fechar();
                    if (loginSenhaInput) {
                        loginSenhaInput.value = "";
                        loginSenhaInput.focus();
                    }
                }, 2200);
            } catch (err) {
                console.warn("Exceção ao atualizar senha:", err?.message || err);
                msgStatus.style.display = "block";
                msgStatus.style.background = "rgba(239, 68, 68, 0.15)";
                msgStatus.style.border = "1px solid #ef4444";
                msgStatus.style.color = "#fca5a5";
                msgStatus.textContent = "Ocorreu um erro ao atualizar sua senha.";
                btnConfirmar.disabled = false;
                btnConfirmar.textContent = "Salvar Nova Senha";
            }
        });
    }

    // Escuta eventos de autenticação via Supabase Auth
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") {
            abrirModalNovaSenha();
        }
    });

    // Verificação proativa de token de recuperação na URL (hash ou query)
    const urlHash = window.location.hash || "";
    const urlQuery = window.location.search || "";
    if (
        urlHash.includes("type=recovery") ||
        urlQuery.includes("type=recovery") ||
        urlHash.includes("recovery") ||
        urlQuery.includes("recovery") ||
        (urlHash.includes("access_token") && urlHash.includes("type=recovery"))
    ) {
        setTimeout(() => {
            abrirModalNovaSenha();
        }, 150);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
