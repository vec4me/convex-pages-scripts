import { watch } from "node:fs";
import { createServer } from "node:http";
import { context } from "esbuild";
import { config, setupDist } from "./frontend-config.ts";

process.env.CONVEX_DEPLOYMENT = process.env.CONVEX_DEPLOYMENT_DEV;

setupDist();

watch("frontend/", { recursive: true }, () => setupDist());
watch("public/", { recursive: true }, () => setupDist());
watch("shared/", { recursive: true }, () => setupDist());

const ctx = await context(config());
await ctx.watch();
const srv = await ctx.serve({ servedir: ".dist/" });
const base = `http://${srv.host || "127.0.0.1"}:${srv.port}`;

createServer(async (req, res) => {
	const url = `${base}${req.url}`;
	let r = await fetch(url);
	if (r.status === 404) {
		r = await fetch(`${base}/index.html`);
		res.setHeader("content-type", "text/html");
	} else {
		const ct = r.headers.get("content-type");
		if (ct) {
			res.setHeader("content-type", ct);
		}
	}
	res.end(Buffer.from(await r.arrayBuffer()));
}).listen(3000);

console.log("Serving at http://localhost:3000");
