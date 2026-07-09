// /login/js/login.js

document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.getElementById("formLogin");
    const loginMessage = document.getElementById("loginMessage");
    const loginEmailInput = document.getElementById("loginEmail");
    const loginSenhaInput = document.getElementById("loginSenha");

    if (!formLogin || !loginMessage) return;

    // Seeding: se não existirem usuários gravados na base, criamos contas demo/padrão
    // para facilitar o teste imediato da aplicação sem passar pela tela de cadastro.
    let usuarios = [];
    try {
        const rawUsers = localStorage.getItem("vh_users");
        if (rawUsers) {
            usuarios = JSON.parse(rawUsers);
        }
    } catch (err) {
        console.error("Erro ao ler vh_users do localStorage:", err);
    }

    // Se a lista estiver vazia, adicionamos usuários de demonstração
    if (usuarios.length === 0) {
        usuarios = [
            {
                nome: "Caíque Brandão",
                email: "caique@gmail.com",
                senha: "123",
                dataNasc: "2008-01-01",
                bio: "Opa me chamo Caíque, tenho 18 anos, amo jogos, principalmente Brawl Stars e Fortnite. Curto um bom Rock e amo uma resenha",
                avatar: "/equipes/images/caiquebrandao.jpg"
            },
            {
                nome: "zZ_Dinho_Winchexxter_Zz",
                email: "dinho@gmail.com",
                senha: "123",
                dataNasc: "1999-05-15",
                bio: "Fala aí, eu sou o Dinho. Curto jogar FPS e participar de campeonatos on-line.",
                avatar: "/equipes/images/dinhowinches.jpg"
            },
            {
                nome: "Mar_cuzcuz",
                email: "marcuzcuz@gmail.com",
                senha: "123",
                dataNasc: "2000-11-20",
                bio: "Eu sou o Marcuzcuz, gosto de Cuzcuz, galinhas e do Vasco.",
                avatar: "/equipes/images/marcuzcuz.jpg"
            }
        ];
        localStorage.setItem("vh_users", JSON.stringify(usuarios));
    }

    // Processamento do formulário de login
    formLogin.addEventListener("submit", (e) => {
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

        // Buscar usuário cadastrado
        const userEncontrado = usuarios.find(u => u.email.toLowerCase() === email);

        if (!userEncontrado) {
            showMessage("E-mail não cadastrado. Verifique ou cadastre-se!", "error");
            return;
        }

        // Validar senha correspondente
        if (userEncontrado.senha !== senha) {
            showMessage("Senha incorreta. Tente novamente.", "error");
            return;
        }

        // Login validado com sucesso!
        showMessage(`Bem-vindo, ${userEncontrado.nome}! Entrando...`, "success");

        // Guardar o usuário ativo em localStorage
        localStorage.setItem("vh_loggedUser", JSON.stringify(userEncontrado));

        // Desabilitar inputs para evitar cliques múltiplos
        loginEmailInput.disabled = true;
        loginSenhaInput.disabled = true;
        const submitBtn = formLogin.querySelector("button[type='submit']");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.5";
        }

        // Redirecionamento após 1.5 segundos
        setTimeout(() => {
            window.location.href = "/pagina_inicial/index.html";
        }, 1500);
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
