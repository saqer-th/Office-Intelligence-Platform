const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

let client;
let ready = false;

function initWhatsApp({ onMessage }) {
  client = new Client({
    authStrategy: new LocalAuth({ clientId: process.env.WHATSAPP_CLIENT_ID || "oomi-os" })
  });

  client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    ready = true;
    console.log("WhatsApp client ready");
  });

  client.on("message", (message) => {
    if (onMessage) {
      onMessage(message);
    }
  });

  client.initialize();
}

async function sendMessage(phone, message) {
  if (!client) {
    throw new Error("WhatsApp client not initialized");
  }
  const digits = phone.replace(/\D/g, "");
  const chatId = `${digits}@c.us`;
  const response = await client.sendMessage(chatId, message);
  return response;
}

function getSessionStatus() {
  return { ready };
}

module.exports = {
  initWhatsApp,
  sendMessage,
  getSessionStatus
};
