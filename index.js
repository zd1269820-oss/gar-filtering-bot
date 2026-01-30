/* ================= CONFIG ================= */

const CONFIG = {
  GENERAL: {
    SERVER_NAME: "Sentinel Alliance",
    ONE_TIME_JOIN: true,
    APPLY_COOLDOWN_HOURS: 48,
    TICKET_COOLDOWN_HOURS: 24
  },

  MESSAGES: {
    ACCEPTED: "✅ You have been accepted into Sentinel Alliance.",
    DENIED: "❌ Your application was denied.",
    FAILED: "🚫 You failed filtering. You may appeal.",
    TICKET_CREATED: "🎫 Your ticket has been created.",
    TICKET_CLOSED: "🔒 Ticket closed.",
    VERIFY_PROMPT: "Put this phrase in your Roblox bio:",
    VERIFIED: "✅ Verification successful.",
    APPLY_SUCCESS: "✅ Application submitted. Staff will review it.",
    APPEAL_SUCCESS: "✅ Appeal submitted."
  },

  ROLES: {
    OWNER_IDS: ["OWNER_ID"],
    STAFF_ROLES: ["STAFF_ROLE_ID"],
    FILTERING: "FILTERING_ROLE_ID",
    VERIFIED: "VERIFIED_ROLE_ID",
    MEMBER: "MEMBER_ROLE_ID",
    DEFAULT_COMPANY: "DEFAULT_COMPANY_ROLE_ID",

    ORDERS: {
      sentinel: ["ROLE_SENTINEL"],
      iron: ["ROLE_IRON"],
      rose: ["ROLE_ROSE"],
      raven: ["ROLE_RAVEN"]
    }
  },

  CHANNELS: {
    SUBMISSIONS: "SUBMISSIONS_CHANNEL_ID",
    APPEALS: "APPEALS_CHANNEL_ID",
    LOGS: "LOGS_CHANNEL_ID",
    TICKET_CATEGORY: "TICKET_CATEGORY_ID",
    TICKET_LOGS: "TICKET_LOG_CHANNEL_ID"
  },

  SECURITY: {
    ANTI_SPAM: {
      MSG_5S: 6,
      MENTIONS: 5,
      TIMEOUT_SECONDS: 15
    }
  },

  QUOTES: [
    "For Honor.",
    "For Sentinel.",
    "Discipline over numbers.",
    "Strength through order.",
    "Loyalty is earned."
  ]
};
