console.log("🔥 SENTINEL ALLIANCE — FULL SYSTEM LOADED 🔥");

require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js");
const noblox = require("noblox.js");

/* ================= CONFIG (EDIT LATER ONLY) ================= */

const CONFIG = {
  GENERAL: {
    ONE_TIME_JOIN: true,
    APPLY_COOLDOWN_HOURS: 48,
    TICKET_COOLDOWN_HOURS: 24
  },

  CHANNELS: {
    APPLICATIONS: "APPLICATION_CHANNEL_ID",
    APPEALS: "APPEALS_CHANNEL_ID",
    TICKET_CATEGORY: "TICKET_CATEGORY_ID",
    LOGS: "LOG_CHANNEL_ID"
  },

  ROLES: {
    STAFF: ["STAFF_ROLE_ID"],
    VERIFIED: "VERIFIED_ROLE_ID",
    FILTERING: "FILTERING_ROLE_ID",
    MEMBER: "MEMBER_ROLE_ID",
    DEFAULT_COMPANY: "DEFAULT_COMPANY_ROLE_ID",

    ORDERS: {
      sentinel: ["ROLE_SENTINEL"],
      iron: ["ROLE_IRON"],
      rose: ["ROLE_ROSE"],
      raven: ["ROLE_RAVEN"]
    }
  },

  ROBLOX: {
    GROUP_ID: 35201289,
    BIO_PREFIX: "Sentinel-",
    ONE_ACCOUNT_ONLY: true
  },

  SECURITY: {
    SPAM_MSG_5S: 6,
    SPAM_MENTIONS: 5,
    TIMEOUT_SECONDS: 15
  },

  MESSAGES: {
    APPLY_SUCCESS: "✅ Application submitted. Staff will review it.",
    TICKET_CREATED: "🎫 Ticket created.",
    APPEAL_SUCCESS: "✅ Appeal submitted.",
    VERIFIED: "✅ Roblox verification successful.",
    ACCEPTED: "✅ You have been accepted.",
    DENIED: "❌ You have been denied.",
    FAILED: "🚫 You failed filtering. You may appeal."
  },

  QUOTES: [
    "For Honor.",
    "For Sentinel.",
    "Discipline over numbers.",
    "Strength through order.",
    "Loyalty is earned."
  ]
};

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= STATE ================= */

const applyCooldown = new Map();
const ticketCooldown = new Map();
const spamTracker = new Map();
const verificationMap = new Map();
const usedRobloxAccounts = new Set();

/* ================= HELPERS ================= */

const embed = (t, d) =>
  new EmbedBuilder().setTitle(t).setDescription(d).setColor(0x0b0b0b).setTimestamp();

const isStaff = m =>
  m.roles.cache.some(r => CONFIG.ROLES.STAFF.includes(r.id));

/* ================= ROBLOX LOGIN ================= */

(async () => {
  if (process.env.ROBLOX_COOKIE) {
    await noblox.setCookie(process.env.ROBLOX_COOKIE);
    console.log("✅ Roblox authenticated");
  }
})();

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder().setName("apply").setDescription("Apply to Sentinel Alliance"),
  new SlashCommandBuilder().setName("ticket").setDescription("Open a ticket"),
  new SlashCommandBuilder().setName("appeal").setDescription("Submit an appeal"),
  new SlashCommandBuilder().setName("quote").setDescription("Get a Sentinel quote"),
  new SlashCommandBuilder().setName("verify").setDescription("Start Roblox verification"),

  new SlashCommandBuilder()
    .setName("verifycheck")
    .setDescription("Check Roblox verification")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("accept")
    .setDescription("Accept applicant")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o =>
      o.setName("order").setDescription("sentinel / iron / rose / raven").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("deny")
    .setDescription("Deny applicant")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("fail")
    .setDescription("Fail filtering")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("demote")
    .setDescription("Demote user")
    .addUserOption(o => o.setName("user").setRequired(true))
];

/* ================= READY ================= */

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {

  /* ===== APPLY ===== */
  if (i.isChatInputCommand() && i.commandName === "apply") {
    const last = applyCooldown.get(i.user.id);
    if (last && Date.now() - last < CONFIG.GENERAL.APPLY_COOLDOWN_HOURS * 3600000)
      return i.reply({ content: "⏳ Application cooldown active.", ephemeral: true });

    applyCooldown.set(i.user.id, Date.now());

    const modal = new ModalBuilder()
      .setCustomId("apply_modal")
      .setTitle("Sentinel Alliance Application");

    modal.addComponents(
      ["Roblox Username", "Profile Link", "Desired Order", "Why Join", "Stats? (YES / NO)"]
        .map((l, idx) =>
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId(`q${idx}`)
              .setLabel(l)
              .setStyle(idx === 3 ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setRequired(true)
          )
        )
    );

    return i.showModal(modal);
  }

  if (i.isModalSubmit() && i.customId === "apply_modal") {
    const ch = i.guild.channels.cache.get(CONFIG.CHANNELS.APPLICATIONS);

    await ch.send(embed(
      "📄 New Application",
      `Applicant: ${i.user.tag}\n\n${[0,1,2,3,4].map(x=>i.fields.getTextInputValue(`q${x}`)).join("\n\n")}`
    ));
    await ch.send("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return i.reply({ content: CONFIG.MESSAGES.APPLY_SUCCESS, ephemeral: true });
  }

  /* ===== ROBLOX VERIFY ===== */
  if (i.isChatInputCommand() && i.commandName === "verify") {
    const phrase = `${CONFIG.ROBLOX.BIO_PREFIX}${Math.floor(Math.random()*99999)}`;
    verificationMap.set(i.user.id, phrase);

    return i.reply({
      embeds: [embed("Roblox Verification", `Put this phrase in your Roblox bio:\n\`${phrase}\``)],
      ephemeral: true
    });
  }

  if (i.isChatInputCommand() && i.commandName === "verifycheck") {
    if (!isStaff(i.member)) return i.reply({ content: "Staff only.", ephemeral: true });

    const user = i.options.getUser("user");
    const phrase = verificationMap.get(user.id);
    if (!phrase) return i.reply("No verification pending.");

    const robloxId = await noblox.getIdFromUsername(user.username).catch(() => null);
    if (!robloxId) return i.reply("Roblox user not found.");

    if (CONFIG.ROBLOX.ONE_ACCOUNT_ONLY && usedRobloxAccounts.has(robloxId))
      return i.reply("Roblox account already used.");

    const bio = await noblox.getBlurb(robloxId);
    if (!bio.includes(phrase)) return i.reply("❌ Phrase not found.");

    const member = await i.guild.members.fetch(user.id);
    await member.roles.add(CONFIG.ROLES.VERIFIED);
    await member.roles.remove(CONFIG.ROLES.FILTERING).catch(()=>{});
    await member.setNickname(await noblox.getUsernameFromId(robloxId)).catch(()=>{});

    usedRobloxAccounts.add(robloxId);
    verificationMap.delete(user.id);

    return i.reply(CONFIG.MESSAGES.VERIFIED);
  }

  /* ===== TICKET ===== */
  if (i.isChatInputCommand() && i.commandName === "ticket") {
    const last = ticketCooldown.get(i.user.id);
    if (last && Date.now() - last < CONFIG.GENERAL.TICKET_COOLDOWN_HOURS * 3600000)
      return i.reply({ content: "⏳ Ticket cooldown active.", ephemeral: true });

    ticketCooldown.set(i.user.id, Date.now());

    const modal = new ModalBuilder()
      .setCustomId("ticket_modal")
      .setTitle("Open Ticket");

    modal.addComponents(
      ["Type", "Who is involved?", "Explain the issue"]
        .map((l, idx) =>
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId(`t${idx}`)
              .setLabel(l)
              .setStyle(idx === 2 ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setRequired(idx !== 1)
          )
        )
    );

    return i.showModal(modal);
  }

  if (i.isModalSubmit() && i.customId === "ticket_modal") {
    const channel = await i.guild.channels.create({
      name: `ticket-${i.user.username}`.toLowerCase(),
      parent: CONFIG.CHANNELS.TICKET_CATEGORY,
      permissionOverwrites: [
        { id: i.guild.id, deny: ["ViewChannel"] },
        { id: i.user.id, allow: ["ViewChannel", "SendMessages"] },
        ...CONFIG.ROLES.STAFF.map(r => ({ id: r, allow: ["ViewChannel", "SendMessages"] }))
      ]
    });

    await channel.send(embed(
      "🎫 Ticket",
      `User: ${i.user.tag}\n\n${[0,1,2].map(x=>i.fields.getTextInputValue(`t${x}`)).join("\n\n")}`
    ));

    return i.reply({ content: CONFIG.MESSAGES.TICKET_CREATED, ephemeral: true });
  }

  /* ===== APPEAL ===== */
  if (i.isChatInputCommand() && i.commandName === "appeal") {
    const modal = new ModalBuilder()
      .setCustomId("appeal_modal")
      .setTitle("Submit Appeal");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("appeal")
          .setLabel("Explain your appeal")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return i.showModal(modal);
  }

  if (i.isModalSubmit() && i.customId === "appeal_modal") {
    const ch = i.guild.channels.cache.get(CONFIG.CHANNELS.APPEALS);
    await ch.send(embed("📣 New Appeal", `${i.user.tag}\n\n${i.fields.getTextInputValue("appeal")}`));
    return i.reply({ content: CONFIG.MESSAGES.APPEAL_SUCCESS, ephemeral: true });
  }

  /* ===== QUOTE ===== */
  if (i.isChatInputCommand() && i.commandName === "quote") {
    return i.reply(embed("Sentinel Quote",
      CONFIG.QUOTES[Math.floor(Math.random()*CONFIG.QUOTES.length)]
    ));
  }

  /* ===== STAFF ACTIONS ===== */
  if (["accept","deny","fail","demote"].includes(i.commandName)) {
    if (!isStaff(i.member)) return i.reply({ content: "Staff only.", ephemeral: true });

    const user = i.options.getUser("user");
    const member = await i.guild.members.fetch(user.id);

    if (i.commandName === "accept") {
      const order = i.options.getString("order").toLowerCase();
      await member.roles.add(CONFIG.ROLES.MEMBER);
      if (CONFIG.ROLES.ORDERS[order]) await member.roles.add(CONFIG.ROLES.ORDERS[order]);
      await member.roles.remove(CONFIG.ROLES.FILTERING).catch(()=>{});
      return i.reply(CONFIG.MESSAGES.ACCEPTED);
    }

    if (i.commandName === "deny") return i.reply(CONFIG.MESSAGES.DENIED);

    if (i.commandName === "fail") {
      await i.guild.members.ban(user.id, { reason: i.options.getString("reason") });
      return i.reply(CONFIG.MESSAGES.FAILED);
    }

    if (i.commandName === "demote") {
      for (const o of Object.values(CONFIG.ROLES.ORDERS)) {
        await member.roles.remove(o).catch(()=>{});
      }
      await member.roles.add(CONFIG.ROLES.DEFAULT_COMPANY);
      return i.reply("⬇️ User demoted.");
    }
  }
});

/* ================= ANTI-SPAM ================= */

client.on("messageCreate", msg => {
  if (!msg.guild || isStaff(msg.member)) return;

  const now = Date.now();
  const arr = spamTracker.get(msg.author.id) || [];
  const recent = arr.filter(t => now - t < 5000);
  recent.push(now);
  spamTracker.set(msg.author.id, recent);

  if (recent.length >= CONFIG.SECURITY.SPAM_MSG_5S) {
    msg.member.timeout(CONFIG.SECURITY.TIMEOUT_SECONDS * 1000).catch(()=>{});
  }

  if (msg.mentions.users.size >= CONFIG.SECURITY.SPAM_MENTIONS) {
    msg.member.ban({ reason: "Mention spam" }).catch(()=>{});
  }
});

/* ================= ONE-TIME JOIN ================= */

client.on("guildMemberRemove", m => {
  if (CONFIG.GENERAL.ONE_TIME_JOIN) {
    m.guild.members.ban(m.id, { reason: "One-time join policy" }).catch(()=>{});
  }
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
