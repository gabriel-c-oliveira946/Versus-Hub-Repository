# VersusHub - Plataforma de Gestão de E-Sports

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

O **VersusHub** é uma plataforma web completa projetada para criar, gerenciar e participar de torneios de E-Sports on-line e presenciais. O sistema centraliza a divulgação de eventos, inscrições de jogadores e equipes, chaveamentos (brackets) e acompanhamento de resultados em tempo real.

---

## Contextualização e Problema

Com o crescimento exponencial do cenário de jogos competitivos, a organização de torneios independentes frequentemente esbarra em limitações logísticas. O uso descentralizado de planilhas, formulários e grupos de mensagens gera:

*   Dificuldade na divulgação e localização de torneios ativos.
*   Desorganização nas inscrições (erros de limite de vagas e confirmações manuais).
*   Falta de transparência em resultados, regras e andamento das chaves.
*   Pouca visibilidade para eventos locais e jogadores amadores.

## A Solução (VersusHub)

O projeto resolve esses gargalos operacionais oferecendo um hub centralizado. Os objetivos alcançados incluem:
1.  **Fluxo Simplificado para Organizadores:** Criação intuitiva de torneios, definição de regras, premiações e gerenciamento de inscritos.
2.  **Organização de Equipes:** Jogadores podem criar times, enviar convites e gerenciar solicitações de entrada de forma autônoma.
3.  **Transparência e Tempo Real:** Recálculo automático de pontuações, atualização de chaves de partidas (brackets) e páginas públicas para espectadores acompanharem os resultados e links de transmissão (Twitch/YouTube).

---

## Principais Funcionalidades

*   **Gestão de Usuários e Equipes:** Perfis customizáveis, histórico de estatísticas (Vitórias/Derrotas) e sistema completo de criação e moderação de equipes.
*   **Motor de Torneios:** Cadastro detalhado de eventos (banner, jogo, online/presencial, datas, regras, limite de vagas).
*   **Chaveamento Interativo (Brackets):** Geração visual de chaves com avanço automatizado de vencedores até a Grande Final.
*   **Sistema de Inscrição Inteligente:** Controle rigoroso de vagas e status de participação (pendente, aceita, recusada).
*   **Módulo de Busca e Filtros:** Pesquisa avançada de torneios por nome, categoria, plataforma e status ("Aberto", "Em andamento", "Encerrado").
*   **Leaderboard e Ranking:** Sistema de pontuação global baseado no rendimento dos jogadores nos torneios disputados.

---

## Arquitetura e Tecnologias

A aplicação foi estruturada utilizando uma arquitetura baseada em componentes e microsserviços simulados, garantindo alta reatividade no Front-end e roteamento eficiente no Back-end:

*   **Back-end:** Node.js com Express.js para roteamento estático e dinâmico de páginas e recursos.
*   **Front-end Moderno:** Configuração base com Vite, integrando React e estilização avançada com TailwindCSS.
*   **Lógica de Interface:** JavaScript Vanilla moderno (ES6+) para manipulação avançada de DOM, gerenciamento de estado das chaves de torneios e transições.
*   **Armazenamento de Dados:** Persistência de dados locais focada na API `localStorage` do navegador, simulando bancos relacionais para as entidades de Usuários, Torneios e Equipes.

---

## ⚙️ Como Executar o Projeto Localmente

### Pré-requisitos
*   [Node.js](https://nodejs.org/) (versão 18 ou superior).
*   Gerenciador de pacotes (`npm` ou `yarn`).

### Passo a Passo

Para visualizar a interface da plataforma corretamente e garantir o funcionamento do armazenamento local (`localStorage`), recomendamos o uso da extensão **Live Server** no VS Code ou a abertura direta do arquivo principal "index.html" localizado na pasta "pagina_inicial", o passo a passo será detalhado a seguir:

1. Clone este repositório:
   ```bash
   git clone [https://github.com/gabriel-c-oliveira946/Versus-Hub-Repository.git](https://github.com/gabriel-c-oliveira946/Versus-Hub-Repository.git)

Abra a pasta do projeto clonado no seu editor de código (ex: VS Code).

No explorador de arquivos, navegue até a pasta pagina_inicial.

Inicie a aplicação:

Opção A (Recomendada): Clique com o botão direito no arquivo index.html e selecione "Open with Live Server".

Opção B: Acesse no seu navegador:
http://localhost:3000

 
