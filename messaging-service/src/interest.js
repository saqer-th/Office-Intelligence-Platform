const INTEREST_KEYWORDS = ["???", "????", "?????", "????", "yes", "interested"];

function detectInterest(message) {
  const text = (message || "").toLowerCase();
  return INTEREST_KEYWORDS.some((keyword) => text.includes(keyword));
}

module.exports = { detectInterest };
