import { verifyKey } from "discord-interactions";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const rawBody = JSON.stringify({ type: 1 });
  const sig = req.headers["x-signature-ed25519"] ?? "none";
  const ts = req.headers["x-signature-timestamp"] ?? "none";
  const pk = process.env.DISCORD_PUBLIC_KEY ?? "not-set";
  const supabaseUrl = process.env.SUPABASE_URL ?? "not-set";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "not-set";

  let verifyResult = "not-run";
  let verifyError = null;
  try {
    verifyResult = String(await verifyKey(rawBody, sig, ts, pk));
  } catch (e) {
    verifyError = e.message;
  }

  let supabaseOk = false;
  let supabaseError = null;
  try {
    const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const { error } = await client.from("players").select("discord_id").limit(1);
    supabaseOk = !error;
    if (error) supabaseError = error.message;
  } catch (e) {
    supabaseError = e.message;
  }

  return res.status(200).json({
    publicKeySet: pk !== "not-set",
    publicKeyLength: pk.length,
    verifyResult,
    verifyError,
    supabaseUrlSet: supabaseUrl !== "not-set",
    supabaseKeySet: supabaseKey !== "not-set",
    supabaseKeyPrefix: supabaseKey.substring(0, 10),
    supabaseOk,
    supabaseError,
  });
}
