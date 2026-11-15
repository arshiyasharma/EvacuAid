// Read-only: is the Photon project reachable, who's on it, any recent messages?
import { Photon } from "@photon-ai/api";

const key = process.env.PHOTON_API_KEY!;
const id = process.env.PHOTON_PROJECT_ID!;
const photon = new Photon({ headers: { Authorization: `Bearer ${key}` } });
const mask = (h?: string) => (h ? h.replace(/\d(?=\d{4})/g, "•") : h);

const tryIt = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (e) {
    const err = e as { status?: number; body?: { code?: string; detail?: string } };
    console.log(`${name}: ${err.status} ${err.body?.code ?? ""} ${err.body?.detail ?? (e as Error).message.slice(0, 120)}`);
  }
};
await tryIt("project", async () => console.log("project ok:", ((await photon.projects.get({ path: { projectId: id } })) as { name?: string }).name));
await tryIt("users", async () => {
  const users = await photon.projects.listUsers({ path: { id }, query: { pageSize: 20 } });
  for (const u of users.items as { kind: string; handle: string; platform: string }[]) console.log("user:", u.kind, u.platform, mask(u.handle));
});
await tryIt("spaces", async () => console.log("spaces:", (await photon.projects.listSpaces({ path: { id }, query: { pageSize: 20 } })).items.length));
await tryIt("messages", async () => {
  const msgs = await photon.projects.listMessages({ path: { id }, query: { pageSize: 10, order: "desc" } });
  console.log("messages:", msgs.items.length);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of msgs.items as any[]) console.log("msg:", m.createdAt, m.status, m.sentBy?.kind, "->", m.receivedBy?.kind, m.content?.text?.slice(0, 40));
});
