import { createApiServer } from "./app";

const parsedPort = Number(process.env.PORT ?? 3001);
const port =
  Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
    ? parsedPort
    : 3001;
const server = createApiServer();
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.listen(port, "0.0.0.0", () => {
  console.log(`Karrinho API listening on http://0.0.0.0:${port}`);
});
