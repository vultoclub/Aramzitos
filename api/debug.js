import { verifyKey } from "discord-interactions";

export default async function handler(req, res) {
  const rawBody = JSON.stringify({ type: 1 });
  const sig = req.headers["x-signature-ed25519"] ?? "none";
  const ts = req.headers["x-signature-timestamp"] ?? "none";
  const pk = process.env.DISCORD_PUBLIC_KEY ?? "not-set";

  let verifyResult = "not-run";
  let verifyError = null;
  try {
    verifyResult = String(verifyKey(rawBody, sig, ts, pk));
  } catch (e) {
    verifyError = e.message;
  }

  return res.status(200).json({
    publicKeySet: pk !== "not-set",
    publicKeyLength: pk.length,
    sigLength: sig.length,
    tsValue: ts,
    verifyResult,
    verifyError,
  });
}
