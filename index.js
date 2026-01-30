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

/* ================= ENV ================= */

const {
  TOKEN,
  CLIENT_ID,
  GUILD_ID,
  SUBMISSIONS_CHANNEL_ID,
  APPEALS_CHANNEL_ID,
  STAFF_ROLE_ID
} = process.env;

/* ================= CLIENT (MUST COME FIRST) ================= */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ================= EMBED HELPER ================= */

const embed = (title, desc) =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(0x0b0b0b)
    .setTimestamp();

/* ================= COMMAND DEFINITIONS ================= */

const commands = [
  new SlashCommandBuilder()
    .setName("apply")
    .setDescription("Apply to Sentinel Alliance"),

  new SlashCommandBuilder()
    .setName("accept")
    .setDescription("Accept an applicant")
    .addUserOption(o =>
      o.setName("user").setDescription("Applicant").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("deny")
    .setDescription("Deny an applicant")
    .addUserOption(o =>
      o.setName("user").setDescription("Applicant").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("appeal")
    .setDescription("Submit an appeal")
];

/* ================= REGISTER COMMANDS ================= */

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  // wipe old
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });

  // register guild
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log("✅ Commands registered clean");
}

/* ================= READY EVENT ================= */

client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  await registerCommands();
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async interaction => {

  /* ===== APPLY ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "apply") {
    const modal = new ModalBuilder()
      .setCustomId("apply_modal")
      .setTitle("Sentinel Alliance Application");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("roblox")
          .setLabel("Roblox Username")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("profile")
          .setLabel("Roblox Profile Link")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("order")
          .setLabel("Order (Sentinel / Iron / Rose / Raven)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("experience")
          .setLabel("Clanning Experience")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("stats")
          .setLabel("Do you have stats? (YES / NO)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  /* ===== APPLY SUBMIT ===== */
  if (interaction.isModalSubmit() && interaction.customId === "apply_modal") {
    const channel = interaction.guild.channels.cache.get(SUBMISSIONS_CHANNEL_ID);

    channel?.send(
      embed(
        "New Application",
        `**User:** ${interaction.user.tag}\n` +
        `**Roblox:** ${interaction.fields.getTextInputValue("roblox")}\n` +
        `**Profile:** ${interaction.fields.getTextInputValue("profile")}\n` +
        `**Order:** ${interaction.fields.getTextInputValue("order")}\n\n` +
        `**Experience:**\n${interaction.fields.getTextInputValue("experience")}\n\n` +
        `**Stats:** ${interaction.fields.getTextInputValue("stats")}`
      )
    );

    channel?.send("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNEXT APPLICANT\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return interaction.reply({
      content: "✅ Application submitted. Staff will review it.",
      ephemeral: true
    });
  }

  /* ===== ACCEPT ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "accept") {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    const user = interaction.options.getUser("user");
    await user.send("✅ You have been accepted into Sentinel Alliance.").catch(() => {});
    return interaction.reply(`Accepted ${user.tag}`);
  }

  /* ===== DENY ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "deny") {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID))
      return interaction.reply({ content: "Staff only.", ephemeral: true });

    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    await user.send(`❌ Application denied.\nReason:\n${reason}`).catch(() => {});
    return interaction.reply(`Denied ${user.tag}`);
  }

  /* ===== APPEAL ===== */
  if (interaction.isChatInputCommand() && interaction.commandName === "appeal") {
    const modal = new ModalBuilder()
      .setCustomId("appeal_modal")
      .setTitle("Sentinel Alliance Appeal");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("appeal")
          .setLabel("Explain your appeal")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "appeal_modal") {
    const ch = interaction.guild.channels.cache.get(APPEALS_CHANNEL_ID);
    ch?.send(
      embed(
        "New Appeal",
        `User: ${interaction.user.tag}\n\n${interaction.fields.getTextInputValue("appeal")}`
      )
    );

    return interaction.reply({
      content: "✅ Appeal submitted.",
      ephemeral: true
    });
  }
});

/* ================= LOGIN ================= */

client.login(TOKEN);
