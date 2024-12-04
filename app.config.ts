import { defineConfig } from "@solidjs/start/config";

const app = defineConfig({
    ssr: false,
    server: {
        experimental: {
            websocket: true
        }
    }
});

app.addRouter({
    name: "websocket",
    type: "http",
    handler: "./src/entry-websocket.ts",
    target: "server",
    "base": "/_ws"
})

export default app;