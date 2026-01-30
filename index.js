console.log("🔥 MODAL VERSION LOADED — NO DMS 🔥");

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

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const SUBMISSIONS_CHANNEL_ID = process.env.SUBMISSIONS_CHANNEL_ID;

/* ================= CLIENT ================= */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ================= EMBED ================= */

const embed = (title, desc) =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(0x0b0b0b)
    .setTimestamp();

/* ================= COMMAND ================= */

const commands = [
  new SlashCommandBuilder()
    .setName("startquiz")
    .setDescription("Begin Sentinel Alliance application")
];

/* ================= DEPLOY ================= */

(async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log("✅ Commands registered clean");
})();

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async interaction => {
  /* SLASH COMMAND */
  if (interaction.isChatInputCommand() && interaction.commandName === "startquiz") {
    const modal = new ModalBuilder()
      .setCustomId("sentinel_quiz")
      .setTitle("Sentinel Alliance Application");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("profile")
          .setLabel("Roblox Profile Link")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("why")
          .setLabel("Why do you want to join Sentinel Alliance?")
          .setStyle(TextInputStyle.Paragraph)
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
          .setCustomId("time")
          .setLabel("How long have you been clanning?")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("stats")
          .setLabel("Do you have stats? (Paste or type no)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  /* MODAL SUBMIT */
  if (interaction.isModalSubmit() && interaction.customId === "sentinel_quiz") {
    const channel = interaction.guild.channels.cache.get(SUBMISSIONS_CHANNEL_ID);

    channel?.send(
      embed(
        "New Sentinel Alliance Application",
        `**User:** ${interaction.user.tag}\n\n` +
        `**Profile:**\n${interaction.fields.getTextInputValue("profile")}\n\n` +
        `**Why Sentinel:**\n${interaction.fields.getTextInputValue("why")}\n\n` +
        `**Experience:**\n${interaction.fields.getTextInputValue("experience")}\n\n` +
        `**Time Clanning:**\n${interaction.fields.getTextInputValue("time")}\n\n` +
        `**Stats:**\n${interaction.fields.getTextInputValue("stats")}`
      )
    );

    channel?.send(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNEXT APPLICANT\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    return interaction.reply({
      content: "✅ Application submitted. Staff will review it.",
      ephemeral: true
    });
  }
});

/* ================= LOGIN ================= */

client.login(TOKEN);
