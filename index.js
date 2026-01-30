client.on("ready", async () => {
  const rest = new (require("discord.js").REST)({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(
    require("discord.js").Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands.map(c => c.toJSON()) }
  );
  console.log("🔁 Forced guild command refresh");
});

console.log("🔥 SENTINEL ALLIANCE FINAL SYSTEM LOADED 🔥");

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

/* ================= ENV ================= */

const {
  TOKEN,
  CLIENT_ID,
  GUILD_ID,
  ROBLOX_COOKIE,
  SUBMISSIONS_CHANNEL_ID,
  APPEALS_CHANNEL_ID,
  VERIFIED_ROLE_ID,
  FILTERING_ROLE_ID,
  MEMBER_ROLE_ID,
  STAFF_ROLE_ID
} = process.env;

/* ================= ORDER ROLE MAP ================= */

const ORDER_ROLES = {
  sentinel: ["ROLE_ID_SENTINEL"],
  iron: ["ROLE_ID_IRON"],
  rose: ["ROLE_ID_ROSE"],
  raven: ["ROLE_ID_RAVEN"]
};

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

/* ================= ROBLOX ================= */

(async () => {
  await noblox.setCookie(ROBLOX_COOKIE);
  console.log("✅ Roblox authenticated");
})();

/* ================= STORAGE ================= */

const verificationMap = new Map(); // discordId -> { robloxId, phrase }
const robloxLock = new Set();      // robloxId (one account)

/* ================= EMBED ================= */

const embed = (t, d) =>
  new EmbedBuilder().setTitle(t).setDescription(d).setColor(0x0b0b0b).setTimestamp();

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder().setName("apply").setDescription("Apply to Sentinel Alliance"),
  new SlashCommandBuilder().setName("verify").setDescription("Start Roblox verification"),
  new SlashCommandBuilder()
    .setName("verifycheck")
    .setDescription("Verify a user (staff)")
    .addUserOption(o => o.setName("user").setRequired(true)),
  new SlashCommandBuilder()
    .setName("accept")
    .setDescription("Accept applicant")
    .addUserOption(o => o.setName("user").setRequired(true)),
  new SlashCommandBuilder()
    .setName("deny")
    .setDescription("Deny applicant")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason").setRequired(true)),
  new SlashCommandBuilder().setName("appeal").setDescription("Submit an appeal")
];

/* ================= DEPLOY ================= */

(async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );
  console.log("✅ Commands registered");
})();

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {

  /* ===== APPLY ===== */
  if (i.isChatInputCommand() && i.commandName === "apply") {
    const modal = new ModalBuilder()
      .setCustomId("apply_modal")
      .setTitle("Sentinel Alliance Application");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("roblox").setLabel("Roblox Username").setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("profile").setLabel("Roblox Profile Link").setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("order").setLabel("Order (Sentinel / Iron / Rose / Raven)").setStyle(TextInputStyle.Short).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("experience").setLabel("Clanning Experience").setStyle(TextInputStyle.Paragraph).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("stats").setLabel("Do you have stats? (YES / NO)").setStyle(TextInputStyle.Short).setRequired(true)
      )
    );

    return i.showModal(modal);
  }

  /* ===== APPLY SUBMIT ===== */
  if (i.isModalSubmit() && i.customId === "apply_modal") {
    const ch = i.guild.channels.cache.get(SUBMISSIONS_CHANNEL_ID);
    ch?.send(
      embed(
        "New Application",
        `User: ${i.user.tag}\nRoblox: ${i.fields.getTextInputValue("roblox")}\nProfile: ${i.fields.getTextInputValue("profile")}\nOrder: ${i.fields.getTextInputValue("order")}\n\n${i.fields.getTextInputValue("experience")}\n\nStats: ${i.fields.getTextInputValue("stats")}`
      )
    );
    ch?.send("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNEXT APPLICANT\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    return i.reply({ content: "✅ Application submitted.", ephemeral: true });
  }

  /* ===== VERIFY ===== */
  if (i.isChatInputCommand() && i.commandName === "verify") {
    const username = i.user.username;
    const robloxId = await noblox.getIdFromUsername(username).catch(() => null);
    if (!robloxId) return i.reply({ content: "❌ Roblox user not found.", ephemeral: true });

    if (robloxLock.has(robloxId))
      return i.reply({ content: "❌ Roblox account already used.", ephemeral: true });

    const phrase = `Sentinel-${Math.floor(Math.random() * 99999)}`;
    verificationMap.set(i.user.id, { robloxId, phrase });
    robloxLock.add(robloxId);

    return i.reply({
      embeds: [embed("Verification", `Put this in your Roblox bio:\n\`${phrase}\``)],
      ephemeral: true
    });
  }

  /* ===== VERIFY CHECK ===== */
  if (i.isChatInputCommand() && i.commandName === "verifycheck") {
    if (!i.member.roles.cache.has(STAFF_ROLE_ID))
      return i.reply({ content: "Staff only.", ephemeral: true });

    const user = i.options.getUser("user");
    const data = verificationMap.get(user.id);
    if (!data) return i.reply("No verification pending.");

    const bio = await noblox.getBlurb(data.robloxId);
    if (!bio || !bio.includes(data.phrase))
      return i.reply("❌ Phrase not found.");

    const robloxName = await noblox.getUsernameFromId(data.robloxId);
    const member = await i.guild.members.fetch(user.id);

    await member.setNickname(robloxName).catch(() => {});
    await member.roles.add(VERIFIED_ROLE_ID).catch(() => {});
    verificationMap.delete(user.id);

    return i.reply(`✅ ${user.tag} verified.`);
  }

  /* ===== ACCEPT ===== */
  if (i.isChatInputCommand() && i.commandName === "accept") {
    if (!i.member.roles.cache.has(STAFF_ROLE_ID)) return i.reply("Staff only.");

    const user = i.options.getUser("user");
    const member = await i.guild.members.fetch(user.id);

    await member.roles.remove(FILTERING_ROLE_ID).catch(() => {});
    await member.roles.add(MEMBER_ROLE_ID).catch(() => {});

    await user.send("✅ You have been accepted.");
    return i.reply(`Accepted ${user.tag}`);
  }

  /* ===== DENY ===== */
  if (i.isChatInputCommand() && i.commandName === "deny") {
    if (!i.member.roles.cache.has(STAFF_ROLE_ID)) return i.reply("Staff only.");

    const user = i.options.getUser("user");
    await user.send(`❌ Denied.\n${i.options.getString("reason")}`);
    return i.reply(`Denied ${user.tag}`);
  }

  /* ===== APPEAL ===== */
  if (i.isChatInputCommand() && i.commandName === "appeal") {
    const modal = new ModalBuilder()
      .setCustomId("appeal_modal")
      .setTitle("Sentinel Alliance Appeal");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("appeal").setLabel("Explain your appeal").setStyle(TextInputStyle.Paragraph).setRequired(true)
      )
    );

    return i.showModal(modal);
  }

  if (i.isModalSubmit() && i.customId === "appeal_modal") {
    const ch = i.guild.channels.cache.get(APPEALS_CHANNEL_ID);
    ch?.send(embed("New Appeal", `${i.user.tag}\n\n${i.fields.getTextInputValue("appeal")}`));
    return i.reply({ content: "Appeal submitted.", ephemeral: true });
  }
});

/* ================= ONE-TIME JOIN ================= */

client.on("guildMemberRemove", async member => {
  await member.guild.members.ban(member.id, {
    reason: "One-time join policy"
  }).catch(() => {});
});

/* ================= LOGIN ================= */

client.login(TOKEN);
