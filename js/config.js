// Conexão com o Supabase. Os dois valores ficam em Supabase > Project Settings > API.
// A chave "anon public" é pública por natureza: quem protege os dados são as regras do banco (supabase/schema.sql).
// NUNCA coloque aqui a chave "service_role".
window.PRIME_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
