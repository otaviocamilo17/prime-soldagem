# Prime Soldagem

Site da Prime Soldagem, empresa de soldagem, caldeiraria, estruturas metálicas e serralheria em Ribeirão Preto, SP.

**Demonstração:** https://otaviocamilo17.github.io/prime-soldagem/

## O que tem
- Página única: serviços, sobre, galeria de trabalhos, por que escolher e contato.
- Orçamento direto pelo WhatsApp: o formulário monta a mensagem e abre o WhatsApp. O site não guarda dados.
- Animação de solda: cordão de solda com faíscas ao rolar a página (desligada para quem prefere menos movimento).
- LGPD: consentimento no formulário e `privacidade.html`.

## Segurança
- Site estático, sem banco de dados, login ou chaves de API.
- Política de segurança (CSP) no `<head>` de cada página.
- `_headers` com HSTS, CSP e outras proteções para Netlify ou Cloudflare Pages (o GitHub Pages ignora este arquivo).

## Estrutura
```
index.html          página principal
privacidade.html    política de privacidade
css/site.css        estilos
js/site.js          formulário e animação
img/                logo e fotos dos trabalhos
```
