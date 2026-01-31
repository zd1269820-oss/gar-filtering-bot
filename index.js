console.log("🔥 SENTINEL ALLIANCE BOT — CLEAN BUILD LOADED 🔥");

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

/* ================= CONFIG (EDIT LATER) ================= */

const CONFIG = {
  GENERAL: {
    SERVER_NAME: "Sentinel Alliance",
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
    MEMBER: "MEMBER_ROLE_ID",
    FILTERING: "FILTERING_ROLE_ID",
    DEFAULT_COMPANY: "DEFAULT_COMPANY_ROLE_ID",

    ORDERS: {
      sentinel: ["ROLE_SENTINEL"],
      iron: ["ROLE_IRON"],
      rose: ["ROLE_ROSE"],
      raven: ["ROLE_RAVEN"]
    }
  },

  MESSAGES: {
    APPLY_SUCCESS: "✅ Application submitted. Staff will review it.",
    TICKET_CREATED: "🎫 Ticket created.",
    APPEAL_SUCCESS: "✅ Appeal submitted.",
    ACCEPTED: "✅ You have been accepted.",
    DENIED: "❌ You have been denied.",
    FAILED: "🚫 You failed filtering. You may appeal."
  },

  SECURITY: {
    SPAM_MSG_5S: 6,
    SPAM_MENTIONS: 5,
    TIMEOUT_SECONDS: 15
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

/* ================= HELPERS ================= */

const embed = (title, desc) =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(0x0b0b0b)
    .setTimestamp();

const isStaff = m =>
  m.roles.cache.some(r => CONFIG.ROLES.STAFF.includes(r.id));

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder().setName("apply").setDescription("Apply to Sentinel Alliance"),
  new SlashCommandBuilder().setName("ticket").setDescription("Open a support ticket"),
  new SlashCommandBuilder().setName("appeal").setDescription("Submit an appeal"),
  new SlashCommandBuilder().setName("quote").setDescription("Get a Sentinel quote"),

  new SlashCommandBuilder()
    .setName("accept")
    .setDescription("Accept applicant")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o =>
      o.setName("order")
        .setDescription("sentinel / iron / rose / raven")
        .setRequired(true)
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
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
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
      return i.reply({ content: "⏳ You are on cooldown.", ephemeral: true });

    applyCooldown.set(i.user.id, Date.now());

    const modal = new ModalBuilder()
      .setCustomId("apply_modal")
      .setTitle("Sentinel Alliance Application");

    modal.addComponents(
      ["Roblox Username", "Roblox Profile Link", "Desired Order", "Why Join", "Stats? (YES / NO)"]
        .map((label, idx) =>
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId(`q${idx}`)
              .setLabel(label)
              .setStyle(idx === 3 ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setRequired(true)
          )
        )
    );

    return i.showModal(modal);
  }

  /* ===== APPLY SUBMIT ===== */
  if (i.isModalSubmit() && i.customId === "apply_modal") {
    const ch = i.guild.channels.cache.get(CONFIG.CHANNELS.APPLICATIONS);

    await ch.send(
      embed(
        "📄 New Application",
        `Applicant: ${i.user.tag}\n\n` +
        [0,1,2,3,4].map(x => i.fields.getTextInputValue(`q${x}`)).join("\n\n")
      )
    );

    await ch.send("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return i.reply({ content: CONFIG.MESSAGES.APPLY_SUCCESS, ephemeral: true });
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
      ["Type (Report / Appeal / Help)", "Who is this about?", "Explain the issue"]
        .map((label, idx) =>
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId(`t${idx}`)
              .setLabel(label)
              .setStyle(idx === 2 ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setRequired(idx !== 1)
          )
        )
    );

    return i.showModal(modal);
  }

  /* ===== TICKET SUBMIT ===== */
  if (i.isModalSubmit() && i.customId === "ticket_modal") {
    const channel = await i.guild.channels.create({
      name: `ticket-${i.user.username}`.toLowerCase(),
      parent: CONFIG.CHANNELS.TICKET_CATEGORY,
      permissionOverwrites: [
        { id: i.guild.id, deny: ["ViewChannel"] },
        { id: i.user.id, allow: ["ViewChannel", "SendMessages"] },
        ...CONFIG.ROLES.STAFF.map(r => ({
          id: r,
          allow: ["ViewChannel", "SendMessages"]
        }))
      ]
    });

    await channel.send(
      embed(
        "🎫 Ticket",
        `User: ${i.user.tag}\n\n` +
        [0,1,2].map(x => i.fields.getTextInputValue(`t${x}`)).join("\n\n")
      )
    );

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
    const q = CONFIG.QUOTES[Math.floor(Math.random() * CONFIG.QUOTES.length)];
    return i.reply(embed("Sentinel Quote", q));
  }

  /* ===== STAFF ACTIONS ===== */
  if (i.isChatInputCommand() && ["accept","deny","fail","demote"].includes(i.commandName)) {
    if (!isStaff(i.member))
      return i.reply({ content: "Staff only.", ephemeral: true });

    const user = i.options.getUser("user");
    const member = await i.guild.members.fetch(user.id);

    if (i.commandName === "accept") {
      const order = i.options.getString("order").toLowerCase();
      await member.roles.add(CONFIG.ROLES.MEMBER);
      if (CONFIG.ROLES.ORDERS[order]) {
        await member.roles.add(CONFIG.ROLES.ORDERS[order]);
      }
      await member.roles.remove(CONFIG.ROLES.FILTERING).catch(()=>{});
      return i.reply(`✅ Accepted ${user.tag}`);
    }

    if (i.commandName === "deny") {
      return i.reply(`❌ Denied ${user.tag}`);
    }

    if (i.commandName === "fail") {
      await i.guild.members.ban(user.id, {
        reason: i.options.getString("reason")
      });
      return i.reply(`🚫 ${user.tag} banned`);
    }

    if (i.commandName === "demote") {
      for (const o of Object.values(CONFIG.ROLES.ORDERS)) {
        await member.roles.remove(o).catch(()=>{});
      }
      await member.roles.add(CONFIG.ROLES.DEFAULT_COMPANY);
      return i.reply("⬇️ User demoted");
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
