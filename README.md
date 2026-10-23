# Prime Soldagem

Site da Prime Soldagem, empresa de soldagem, caldeiraria, estruturas metálicas e serralheria em Ribeirão Preto, SP.

**Demonstração:** https://otaviocamilo17.github.io/prime-soldagem/

## O que tem
- Página única: serviços, sobre, galeria de trabalhos, por que escolher e contato.
- Orçamento direto pelo WhatsApp: o formulário monta a mensagem e abre o WhatsApp. O site não guarda dados.
- Animação de solda: cordão de solda com faíscas ao rolar a página (desligada para quem prefere menos movimento).
- LGPD: consentimento no formulário e `privacidade.html`.

## Banco de dados (Supabase)
- `supabase/schema.sql`: tabelas de clientes, orçamentos, pedidos, fotos e informações do site, com as regras de acesso (RLS) e a pasta de fotos.
- `js/config.js`: URL do projeto e chave **anon public**. Enquanto estiver vazio, o site funciona com o conteúdo fixo.
- `conta.html`: cadastro e área do cliente (orçamentos, pedidos e dados).
- `admin.html`: painel da empresa, com login. Só e-mails cadastrados na tabela `admins` entram.

## Segurança
- Nenhuma chave secreta no código. A chave anon é pública por natureza; quem protege os dados são as regras do banco.
- Cada cliente só enxerga os próprios orçamentos e pedidos. Visitantes só conseguem criar pedidos de orçamento novos, sem valor.
- Política de segurança (CSP) no `<head>` de cada página.
- `_headers` com HSTS, CSP e outras proteções para Netlify ou Cloudflare Pages (o GitHub Pages ignora este arquivo).

## Estrutura
```
index.html          página principal
conta.html          cadastro e área do cliente
admin.html          painel da empresa
supabase/schema.sql banco de dados e regras de acesso
privacidade.html    política de privacidade
css/site.css        estilos
js/site.js          formulário, conteúdo do banco e animação
js/conta.js         área do cliente
js/admin.js         painel
js/config.js        conexão com o Supabase
img/                logo e fotos dos trabalhos
```
