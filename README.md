# Palavra Divina — App do Pregador

App para pregadores: esboços de sermão, Bíblia completa (duas versões), dicionário bíblico, glossário de palavras difíceis e ferramentas de homilética. Funciona no celular e no computador, sem login e sem internet depois de aberto pela primeira vez.

## Funcionalidades

- **Esboços**: título, texto base, tema, grande ideia, introdução, pontos (referências, explicação, ilustração, aplicação), conclusão, apelo e anotações. Salvamento automático, busca e status (rascunho, pronto, pregado).
- **8 modelos de esboço**: temático, textual, expositivo, narrativo, evangelístico, Santa Ceia, casamento e culto fúnebre.
- **Modo púlpito**: letra grande, tela cheia e cronômetro.
- **Bíblia**: Bíblia Livre (BLIVRE) e Nova Bíblia Viva (NBV). Leitura por livro e capítulo, busca com filtro por livro, testamento ou grupo, e inserção de versículos no esboço.
- **Palavras difíceis**: toque numa palavra sublinhada na Bíblia para ver o significado.
- **Dicionário bíblico**, livros da Bíblia, banco de ilustrações, cronômetro, dicas de homilética e temas para sermões.
- **Backup e importação** em arquivo `.json`.

## Armazenamento

Todos os dados ficam **somente no aparelho**, no IndexedDB do navegador. Não há servidor nem banco de dados externo. Faça backup com frequência (Ferramentas → Backup).

## Como publicar (GitHub Pages)

Settings → Pages → Source: *Deploy from a branch* → Branch: `main` / `(root)`. O app fica em `https://consultor-pro.github.io/PALAVRA-DIVINA/`.

## Créditos dos textos bíblicos

- **Bíblia Livre (BLIVRE)** — Copyright © Diego Santos, Mario Sérgio e Marco Teles — http://sites.google.com/site/biblialivre/. Licença Creative Commons Atribuição 4.0 Brasil (http://creativecommons.org/licenses/by/4.0/br/). Texto obtido via eBible.org.
- **Biblica® Open Nova Bíblia Viva™** — Copyright © 2007, 2010 Biblica, Inc. “Biblica” é marca registrada de Biblica, Inc. Licença Creative Commons Atribuição-CompartilhaIgual 4.0 Internacional (https://creativecommons.org/licenses/by-sa/4.0). Texto obtido via eBible.org.

Os textos bíblicos são distribuídos sem alterações, sob suas respectivas licenças. O dicionário, o glossário, os resumos dos livros, os modelos e as dicas foram escritos para este app.
