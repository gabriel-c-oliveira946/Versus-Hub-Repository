// ====== FUNÇÕES AUXILIARES ======

function getUsers() {
  const usersJSON = localStorage.getItem('vh_users');
  return usersJSON ? JSON.parse(usersJSON) : [];
}

function saveUsers(users) {
  localStorage.setItem('vh_users', JSON.stringify(users));
}

// ====== LoGICA DO CadASTRO ======

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const nome  = form.querySelector('input[placeholder="Nome de Usuário"]').value.trim();
    const email = form.querySelector('input[type="email"]').value.trim();
    const senha = form.querySelector('input[placeholder="Senha"]').value;
    const dataNasc = form.querySelector('input[type="date"]').value;

    if (!nome || !email || !senha) {
      alert('Preencha nome, e-mail e senha.');
      return;
    }

    // pega lista de usuários já cadastrados

    const raw = localStorage.getItem('vh_users');
    const usuarios = raw ? JSON.parse(raw) : [];

    // impede email repetido

    const jaExiste = usuarios.some(u => u.email === email);
    if (jaExiste) {
      alert('Já existe uma conta com esse e-mail.');
      return;
    }

    const novoUsuario = { nome, email, senha, dataNasc };

    usuarios.push(novoUsuario);
    localStorage.setItem('vh_users', JSON.stringify(usuarios));

    // ja deixa logado

    localStorage.setItem('vh_loggedUser', JSON.stringify(novoUsuario));

    alert('Cadastro realizado com sucesso!');
    window.location.href = '/pagina_inicial/index.html';
  });
});

