import { requireUser } from "@/lib/auth";
import { getLivePayload } from "@/lib/liveServer";
import { expireStalePending } from "@/lib/online";
import LiveBoard from "./LiveBoard";

export const metadata = { title: "Sesi Live" };

export default async function LivePage() {
  await requireUser();
  await expireStalePending();
  return <LiveBoard initial={await getLivePayload()} />;
}
