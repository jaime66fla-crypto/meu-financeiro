# Meu Financeiro

Controle financeiro pessoal com GitHub Pages e Supabase.

## Recursos

Login e cadastro por e-mail; receitas e despesas; categorias; filtro mensal; contas pagas, pendentes e vencidas; orçamento mensal; metas; observações; relatório para impressão em PDF; tema claro e escuro.

## Publicação

Em Settings → Pages, selecione Deploy from a branch, branch main e pasta / (root), e salve.

## Supabase

Projeto Meu-Financeiro. O cliente usa somente a chave publicável; nenhuma chave secreta é necessária no repositório. Todas as tabelas devem manter RLS por user_id.

Em Authentication → URL Configuration, configure Site URL como https://jaime66fla-crypto.github.io/meu-financeiro/ para que a confirmação de cadastro retorne ao site.

Dependência: @supabase/supabase-js 2.49.8, distribuição UMD em supabase.js (MIT).
