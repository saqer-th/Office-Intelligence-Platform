require("dotenv").config();
const express = require("express");
const { initDb, saveMessage, findOfficeByPhone, findGroupByOffice } = require("./db");
const { initWhatsApp, getSessionStatus } = require("./whatsapp");
const { detectInterest } = require("./interest");

const app = express();
app.use(express.json());

const routes = require("./routes");
app.use(routes);

app.get("/session/status", (req, res) => {
  res.json(getSessionStatus());
});

async function handleIncoming(message) {
  if (message.fromMe) return;
  const phone = message.from || "";
  const body = message.body || "";

  const office = await findOfficeByPhone(phone);
  const officeId = office ? office.id : null;
  const group = officeId ? await findGroupByOffice(officeId) : null;
  const groupId = group ? group.group_id : null;

  await saveMessage({
    office_id: officeId,
    group_id: groupId,
    phone,
    direction: "IN",
    status: "received",
    body,
    provider_msg_id: message.id?.id || null
  });

  if (detectInterest(body) && officeId) {
    try {
      await fetch(`${process.env.CORE_API_BASE_URL}/webhooks/whatsapp/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          office_id: officeId,
          group_id: groupId,
          interest_status: "Interested"
        })
      });
    } catch (error) {
      console.error("Failed to notify core backend", error);
    }
  }
}

async function start() {
  await initDb();
  initWhatsApp({ onMessage: handleIncoming });

  const port = process.env.PORT || 4100;
  app.listen(port, () => {
    console.log(`Messaging service running on ${port}`);
  });
}

start();
