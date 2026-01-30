require("dotenv").config();
const {
  Client, GatewayIntentBits, Partials,
  SlashCommandBuilder, REST, Routes,
  EmbedBuilder, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder
} = require("discord.js");
const noblox = require("noblox.js");

/* ================= ROBLOX ================= */

(async () => {
  await noblox.setCookie(process.env.ROBLOX_COOKIE);
  console.log("✅ Roblox authenticated");
})();

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

/* ================= CONFIG ================= */

const {
  TOKEN,
  CLIENT_ID,
  GUILD_ID,
  ROBLOX_GROUP_ID,
  SCREENING_CHANNEL_ID,
  SUBMISSIONS_CHANNEL_ID,
  OWNER_ID
} = process.env;

/* 🔐 ROLE IDS */

const STAFF_ROLE_IDS = [
  "STAFF_ROLE_ID_1",
  "STAFF_ROLE_ID_2"
];

const FILTERING_ROLE_ID = "FILTERING_ROLE_ID";

const STANDARD_COMPANY_ROLES = [
  "STANDARD_ROLE_1",
  "STANDARD_ROLE_2"
];

const COMPANY_PRESETS = {
  sentinel: {
    name: "Order of Sentinel",
    robloxRank: 10,
    discordRoles: ["ROLE_SENTINEL"]
  },
  iron: {
    name: "Order of Iron",
    robloxRank: 60,
    discordRoles: ["ROLE_IRON"]
  }
};

/* ================= STORAGE ================= */

const linkedAccounts = new Map();
const tickets = new Map();

/* ================= HELPERS ================= */

const isStaff = m =>
  m.roles.cache.some(r => STAFF_ROLE_IDS.includes(r.id));

const dark = (title, desc) =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(0x0b0b0b)
    .setTimestamp();

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder()
    .setName("linkroblox")
    .setDescription("Link your Roblox account")
    .addStringOption(o =>
      o.setName("username").setRequired(true)),

  new SlashCommandBuilder()
    .setName("passtryout")
    .setDescription("Pass a user into a company")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o =>
      o.setName("company").setRequired(true)
        .addChoices(
          { name: "Sentinel", value: "sentinel" },
          { name: "Iron", value: "iron" }
        )),

  new SlashCommandBuilder()
    .setName("demote")
    .setDescription("Demote user to standard company")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("fail")
    .setDescription("Fail applicant and ban")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("appeal")
    .setDescription("Submit an appeal")
    .addStringOption(o =>
      o.setName("roblox").setDescription("Roblox username").setRequired(true))
    .addStringOption(o =>
      o.setName("reason").setDescription("Appeal reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Ticket system")
    .addSubcommand(s => s.setName("open"))
    .addSubcommand(s => s.setName("close")),

  new SlashCommandBuilder()
    .setName("claim")
    .setDescription("Claim a ticket")
];

/* ================= DEPLOY ================= */

(async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );
  console.log("✅ Commands deployed");
})();

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  /* AUTO-KICK CHECK (EVERY HOUR) */
  setInterval(async () => {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;

    await guild.members.fetch();

    guild.members.cache.forEach(async m => {
      if (!m.roles.cache.has(FILTERING_ROLE_ID)) return;

      const days = (Date.now() - m.joinedAt) / 86400000;
      if (days < 5) return;

      try {
        await m.send(
          dark(
            "Removed from Sentinel Alliance",
`You failed to complete screening within **5 days**.

You have been removed from the server.

You may submit **one appeal** using:
/appeal <roblox username> <reason>`
          )
        );
      } catch {}

      await m.kick("Failed to complete screening in 5 days");

      const log = guild.channels.cache.get(SUBMISSIONS_CHANNEL_ID);
      log?.send(
        dark(
          "Auto-Removed (Screening Timeout)",
`User: ${m.user.tag}
Reason: Did not complete filtering in 5 days`
        )
      );
    });
  }, 60 * 60 * 1000);
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {

  /* ===== APPEAL COMMAND (PUBLIC) ===== */
  if (i.isChatInputCommand() && i.commandName === "appeal") {
    const roblox = i.options.getString("roblox");
    const reason = i.options.getString("reason");

    const ch = i.guild.channels.cache.get(SUBMISSIONS_CHANNEL_ID);
    ch?.send(
      dark(
        "New Appeal Submitted",
`Discord: ${i.user.tag} (${i.user.id})
Roblox: ${roblox}

Reason:
${reason}`
      )
    );

    return i.reply({
      content: "✅ Appeal submitted. Staff will review it.",
      ephemeral: true
    });
  }

  /* ===== FAIL MODAL SUBMIT ===== */
  if (i.isModalSubmit() && i.customId === "fail_modal") {
    const reason = i.fields.getTextInputValue("reason");
    const userId = i.fields.getTextInputValue("userid");
    const member = await i.guild.members.fetch(userId).catch(() => null);

    if (member) {
      await member.send(
        dark(
          "Application Failed",
`Reason:
${reason}

You have been removed from Sentinel Alliance.

You may submit **one appeal** to the Owner:
<@${OWNER_ID}>`
        )
      ).catch(() => {});

      await member.ban({ reason: "Screening failed" });
    }

    i.guild.channels.cache.get(SUBMISSIONS_CHANNEL_ID)
      ?.send(dark("Applicant Failed", `User ID: ${userId}\nReason:\n${reason}`));

    return i.reply({ content: "❌ Applicant failed.", ephemeral: true });
  }

  if (!i.isChatInputCommand()) return;

  /* LINK ROBLOX */
  if (i.commandName === "linkroblox") {
    try {
      const id = await noblox.getIdFromUsername(
        i.options.getString("username")
      );
      linkedAccounts.set(i.user.id, id);
      return i.reply("🔗 Roblox linked.");
    } catch {
      return i.reply("❌ Roblox user not found.");
    }
  }

  /* STAFF ONLY BELOW */
  if (!isStaff(i.member))
    return i.reply({ content: "❌ Staff only.", ephemeral: true });

  /* FAIL */
  if (i.commandName === "fail") {
    const user = i.options.getUser("user");
    const modal = new ModalBuilder()
      .setCustomId("fail_modal")
      .setTitle("Fail Applicant")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Failure Reason")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("userid")
            .setLabel("User ID (DO NOT EDIT)")
            .setStyle(TextInputStyle.Short)
            .setValue(user.id)
        )
      );
    return i.showModal(modal);
  }

  /* PASS TRYOUT */
  if (i.commandName === "passtryout") {
    const user = i.options.getUser("user");
    const preset = COMPANY_PRESETS[i.options.getString("company")];
    const robloxId = linkedAccounts.get(user.id);
    if (!robloxId) return i.reply("❌ User not linked.");

    const member = await i.guild.members.fetch(user.id);
    for (const r of preset.discordRoles)
      await member.roles.add(r).catch(() => {});
    await noblox.setRank(ROBLOX_GROUP_ID, robloxId, preset.robloxRank);

    return i.reply(`✅ ${user.tag} placed into **${preset.name}**`);
  }

  /* DEMOTE */
  if (i.commandName === "demote") {
    const user = i.options.getUser("user");
    const robloxId = linkedAccounts.get(user.id);
    const member = await i.guild.members.fetch(user.id);

    for (const p of Object.values(COMPANY_PRESETS))
      for (const r of p.discordRoles)
        await member.roles.remove(r).catch(() => {});

    for (const r of STANDARD_COMPANY_ROLES)
      await member.roles.add(r).catch(() => {});

    if (robloxId)
      await noblox.setRank(ROBLOX_GROUP_ID, robloxId, 1);

    return i.reply(`⬇️ ${user.tag} demoted.`);
  }

  /* TICKETS */
  if (i.commandName === "ticket") {
    if (i.options.getSubcommand() === "open") {
      const ch = await i.guild.channels.create({
        name: `ticket-${i.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: i.guild.id, deny: ["ViewChannel"] },
          { id: i.user.id, allow: ["ViewChannel", "SendMessages"] }
        ]
      });
      tickets.set(i.user.id, ch.id);
      return i.reply({ content: `🎫 ${ch}`, ephemeral: true });
    }

    if (i.options.getSubcommand() === "close") {
      const chId = tickets.get(i.user.id);
      await i.guild.channels.cache.get(chId)?.delete();
      tickets.delete(i.user.id);
      return i.reply("✅ Ticket closed.");
    }
  }

  if (i.commandName === "claim") {
    await i.channel.permissionOverwrites.edit(i.user.id, {
      ViewChannel: true,
      SendMessages: true
    });
    return i.reply(`🎫 Claimed by ${i.user.tag}`);
  }
});

/* ================= WELCOME + SCREENING ================= */

client.on("guildMemberAdd", async m => {
  try {
    await m.send(
      dark(
        "Welcome to Sentinel Alliance",
`You have **5 days** to complete filtering.

Failure to do so will result in removal.

Follow all instructions carefully.`
      )
    );
  } catch {}

  m.guild.channels.cache.get(SCREENING_CHANNEL_ID)?.send({
    content: `<@${m.id}>`,
    embeds: [
      dark(
        "Filtering Process",
"Begin Phase 1 immediately. Check pinned messages."
      )
    ]
  });
});

/* ================= SAFETY ================= */

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
