const express = require("express");
const router = express.Router();
const { saveMessage, updateMessageStatus } = require("./db");
const { sendMessage } = require("./whatsapp");

router.post("/messages/send", async (req, res) => {
  const { office_id, group_id, phone, message } = req.body || {};
  if (!phone || !message) {
    return res.status(400).json({ error: "phone and message are required" });
  }

  try {
    const messageId = await saveMessage({
      office_id: office_id || null,
      group_id: group_id || null,
      phone,
      direction: "OUT",
      status: "queued",
      body: message,
      provider_msg_id: null
    });

    const sent = await sendMessage(phone, message);
    await updateMessageStatus(messageId, "sent", sent.id?.id || null);

    return res.json({ id: messageId, status: "sent" });
  } catch (error) {
    return res.status(500).json({ error: "failed_to_send" });
  }
});

module.exports = router;
