import { routePartykitRequest } from "partyserver";
import type { Env } from "./room";

export { Room } from "./room";

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routePartykitRequest(request, env as never)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
