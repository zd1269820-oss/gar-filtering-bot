require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require("discord.js");
const noblox = require("noblox.js");

/* ================= BOOT CHECK ================= */
console.log("BOOT CHECK — SENTINEL ALLIANCE BOT");
console.log("CLIENT_ID:", process.env.CLIENT_ID);
console.log("GUILD_ID:", process.env.GUILD_ID);

/* ================= ROBLOX ================= */
(async () => {
  try {
    await noblox.setCookie(process.env.ROBLOX_COOKIE);
    console.log("✅ Roblox authenticated");
  } catch (e) {
    console.error("❌ Roblox auth failed", e);
  }
})();

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
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

/* ================= ROLES ================= */
const STAFF_ROLE_IDS = [
  "STAFF_ROLE_ID_1",
  "STAFF_ROLE_ID_2"
];

const FILTERING_ROLE_ID = "FILTERING_ROLE_ID";

const AUTO_ROLE_IDS = [FILTERING_ROLE_ID];

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
  },
  rose: {
    name: "Order of Rose",
    robloxRank: 15,
    discordRoles: ["ROLE_ROSE"]
  },
  raven: {
    name: "Order of Raven",
    robloxRank: 40,
    discordRoles: ["ROLE_RAVEN"]
  }
};

/* ================= STORAGE ================= */
const linkedAccounts = new Map();
const tickets = new Map();

/* ================= HELPERS ================= */
const isStaff = member =>
  member.roles.cache.some(r => STAFF_ROLE_IDS.includes(r.id));

const darkEmbed = (title, description) =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0x0b0b0b)
    .setTimestamp();

/* ================= SLASH COMMANDS ================= */
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Test if the bot is responding"),

  new SlashCommandBuilder()
    .setName("linkroblox")
    .setDescription("Link your Roblox account")
    .addStringOption(o =>
      o.setName("username")
        .setDescription("Your Roblox username")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("passtryout")
    .setDescription("Pass a user into a company")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to pass")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("company")
        .setDescription("Company to assign")
        .setRequired(true)
        .addChoices(
          { name: "Sentinel", value: "sentinel" },
          { name: "Iron", value: "iron" },
          { name: "Rose", value: "rose" },
          { name: "Raven", value: "raven" }
        )
    ),

  new SlashCommandBuilder()
    .setName("demote")
    .setDescription("Demote a user to standard company")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to demote")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("fail")
    .setDescription("Fail an applicant and ban them")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("Applicant to fail")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("appeal")
    .setDescription("Submit an appeal to the owner")
    .addStringOption(o =>
      o.setName("roblox")
        .setDescription("Your Roblox username")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Reason for appeal")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Ticket system")
    .addSubcommand(s =>
      s.setName("open")
        .setDescription("Open a ticket")
    )
    .addSubcommand(s =>
      s.setName("close")
        .setDescription("Close your ticket")
    ),

  new SlashCommandBuilder()
    .setName("claim")
    .setDescription("Claim a ticket")
];

/* ================= DEPLOY COMMANDS ================= */
(async () => {
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log("✅ Commands deployed");
  } catch (e) {
    console.error("❌ Command deploy failed", e);
  }
})();

/* ================= READY ================= */
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  /* AUTO-KICK FILTERING (HOURLY) */
  setInterval(async () => {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;

    await guild.members.fetch();
    guild.members.cache.forEach(async member => {
      if (!member.roles.cache.has(FILTERING_ROLE_ID)) return;

      const days = (Date.now() - member.joinedAt) / 86400000;
      if (days < 5) return;

      try {
        await member.send(
          darkEmbed(
            "Removed from Sentinel Alliance",
            "You did not complete screening within 5 days.\n\nYou may submit **one appeal** using `/appeal`."
          )
        );
      } catch {}

      await member.kick("Filtering timeout");

      guild.channels.cache.get(SUBMISSIONS_CHANNEL_ID)
        ?.send(
          darkEmbed(
            "Auto-Kick (Filtering Timeout)",
            `User: ${member.user.tag}`
          )
        );
    });
  }, 60 * 60 * 1000);
});

/* ================= INTERACTIONS ================= */
client.on("interactionCreate", async i => {

  /* APPEAL (PUBLIC) */
  if (i.isChatInputCommand() && i.commandName === "appeal") {
    i.guild.channels.cache.get(SUBMISSIONS_CHANNEL_ID)
      ?.send(
        darkEmbed(
          "New Appeal",
          `Discord: ${i.user.tag}\nRoblox: ${i.options.getString("roblox")}\n\n${i.options.getString("reason")}`
        )
      );
    return i.reply({ content: "✅ Appeal submitted.", ephemeral: true });
  }

  /* FAIL MODAL SUBMIT */
  if (i.isModalSubmit() && i.customId === "fail_modal") {
    const reason = i.fields.getTextInputValue("reason");
    const userId = i.fields.getTextInputValue("userid");
    const member = await i.guild.members.fetch(userId).catch(() => null);

    if (member) {
      await member.send(
        darkEmbed(
          "Application Failed",
          `${reason}\n\nAppeals are **owner-only**: <@${OWNER_ID}>`
        )
      ).catch(() => {});
      await member.ban({ reason: "Screening failed" });
    }

    i.guild.channels.cache.get(SUBMISSIONS_CHANNEL_ID)
      ?.send(
        darkEmbed("Applicant Failed", `User ID: ${userId}\n\n${reason}`)
      );

    return i.reply({ content: "❌ Applicant failed.", ephemeral: true });
  }

  if (!i.isChatInputCommand()) return;

  /* BASIC */
  if (i.commandName === "ping")
    return i.reply(`🏓 ${client.ws.ping}ms`);

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

  /* STAFF ONLY */
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

    for (const p of Object.values(COMPANY_PRESETS))
      for (const r of p.discordRoles)
        await member.roles.remove(r).catch(() => {});

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

/* ================= JOIN HANDLER ================= */
client.on("guildMemberAdd", async member => {
  for (const r of AUTO_ROLE_IDS)
    await member.roles.add(r).catch(() => {});

  try {
    await member.send(
      darkEmbed(
        "Welcome to Sentinel Alliance",
        "You are now in filtering.\nYou have **5 days** to complete screening."
      )
    );
  } catch {}

  member.guild.channels.cache.get(SCREENING_CHANNEL_ID)
    ?.send({ content: `<@${member.id}>` });
});

/* ================= SAFETY ================= */
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
