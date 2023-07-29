import { createServer } from "node:http";
import staticHandler from "serve-handler";
import ws, { WebSocketServer } from "ws";
import zeromq from "zeromq";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv)).argv


const server = createServer((req, res) => {
  return staticHandler(req, res, { public: "www" });
});

const wss = new WebSocketServer({ server });

function broadcast(message) {
  for (const wsClient of wss.clients) {
    if (wsClient.readyState === ws.OPEN) {
      wsClient.send(message);
    }
  }
}

let pubSocket;

async function initializeSocket() {
  pubSocket = new zeromq.Publisher();
  await pubSocket.bind(`tcp://127.0.0.1:${argv.pub}`);

  const subSocket = new zeromq.Subscriber();
  const subPorts = [].concat(argv.sub);
  for (const port of subPorts) {
    console.log("Subscribing to port %d", port);
    await subSocket.connect(`tcp://127.0.0.1:${port}`);
  }

  subSocket.subscribe("chat");

  for await (const [msg] of subSocket) {
    console.log('Message from another server: %s', msg);
    const data = msg.toString().replace(new RegExp('^chat '), '');
    broadcast(data);
  }
}

initializeSocket();

wss.on("connection", (client) => {
  console.log("Client connected");
  client.on("message", (message) => {
    console.log("Message: ", message);
    broadcast(message);
    pubSocket.send(`chat ${message}`);
  });
});

server.listen(argv.http || 8000);
