import {createHash} from "node:crypto";
import {getApps, initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {MAX_RETRIES} from "./config.js";
import {approvedPilotUids, reserveQuota, type BriefingRequest} from "./briefingPolicy.js";

export class BriefingAccessError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

/** No external calls unless pilot, authentication and durable quota all succeed. */
export async function admitBriefing(authorization: string | undefined, input: BriefingRequest): Promise<void> {
  const allowed = approvedPilotUids(process.env.BRIEFING_ENABLED, process.env.BRIEFING_ALLOWED_UIDS);
  if (!allowed.size) throw new BriefingAccessError(503, "외부 브리핑은 아직 활성화되지 않았습니다.");
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_.-]{20,8192})$/);
  if (!match) throw new BriefingAccessError(401, "외부 브리핑 인증이 필요합니다.");
  const app = getApps()[0] ?? initializeApp();
  let uid: string;
  try {
    // Verify signature, issuer, audience, expiration, revocation and disabled accounts.
    uid = (await getAuth(app).verifyIdToken(match[1], true)).uid;
  } catch {
    throw new BriefingAccessError(401, "외부 브리핑 인증이 유효하지 않습니다.");
  }
  if (!allowed.has(uid)) throw new BriefingAccessError(403, "외부 브리핑 이용 승인이 필요합니다.");

  const db = getFirestore(app);
  const global = db.collection("_briefingQuotas").doc("global");
  const user = db.collection("_briefingQuotas").doc(
    "user_" + createHash("sha256").update(uid).digest("hex"),
  );
  let admitted: boolean;
  try {
    admitted = await db.runTransaction(async (tx) => {
      const [g, u] = await tx.getAll(global, user);
      const next = reserveQuota(g.data(), u.data(), Date.now(),
        (input.stockTickers?.length ?? 0) * MAX_RETRIES);
      if (!next) return false;
      tx.set(global, next.global);
      tx.set(user, next.user);
      return true;
    });
  } catch {
    // A quota-store outage must never become an unlimited external call.
    throw new BriefingAccessError(503, "외부 브리핑 요청 한도를 확인하지 못했습니다.");
  }
  if (!admitted) throw new BriefingAccessError(429, "요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
}
