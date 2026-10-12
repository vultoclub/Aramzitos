import { getSupabase } from "../src/supabase.js";

export default async function handler(req, res) {
  // Inicializa o cliente Supabase para manter a conexao aquecida
  try { getSupabase(); } catch {}
  return res.status(200).json({ ok: true, ts: Date.now() });
}
