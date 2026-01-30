require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder
} = require("discord.js");

/* ================= ENV ================= */

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const SUBMISSIONS_CHANNEL_ID = process.env.SUBMISSIONS_CHANNEL_ID;

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

/* ================= QUIZ DATA ================= */

const activeQuizzes = new Map();

const QUESTIONS = [
  "Send your **Roblox profile link**.",
  "Why do you want to join **Sentinel Alliance**?",
  "Describe your clanning experience.",
  "How long have you been clanning?",
  "Do you have stats? If yes, send them. If no, type `no`."
];

/* ================= EMBED ================= */

const embed = (title, desc) =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(0x0b0b0b);

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder()
    .setName("startquiz")
    .setDescription("Begin Sentinel Alliance quiz")
];

/* ================= DEPLOY ================= */

(async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  // wipe old commands
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

/* ================= SLASH COMMAND ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "startquiz") {
    // ALWAYS ACK FIRST
    await interaction.deferReply({ ephemeral: true });

    // clear any old state
    activeQuizzes.delete(interaction.user.id);

    try {
      activeQuizzes.set(interaction.user.id, {
        step: 0,
        answers: []
      });

      await interaction.user.send(
        embed(
          "Sentinel Alliance Screening",
`Hello **${interaction.user.username}**,

This quiz is conducted in **DMs**.
Answer honestly.

**Question 1:**  
${QUESTIONS[0]}`
        )
      );

      return interaction.editReply({
        content: "📩 I’ve sent you a DM. Please check it to continue."
      });

    } catch (err) {
      activeQuizzes.delete(interaction.user.id);

      return interaction.editReply({
        content:
          "❌ I could not DM you.\n\nEnable **Allow Direct Messages from server members**, restart Discord, then try again."
      });
    }
  }
});

/* ================= DM HANDLER ================= */

client.on("messageCreate", async message => {
  if (message.guild) return;

  const quiz = activeQuizzes.get(message.author.id);
  if (!quiz) return;

  quiz.answers.push(message.content);
  quiz.step++;

  if (quiz.step >= QUESTIONS.length) {
    activeQuizzes.delete(message.author.id);

    const channel = client.channels.cache.get(SUBMISSIONS_CHANNEL_ID);
    if (channel) {
      await channel.send(
        embed(
          "New Submission",
          `User: ${message.author.tag}\n\n` +
          quiz.answers
            .map((a, i) => `**Q${i + 1}:**\n${a}`)
            .join("\n\n")
        )
      );
      await channel.send(
        "━━━━━━━━━━━━━━━━━━━━━━\nNEXT APPLICANT\n━━━━━━━━━━━━━━━━━━━━━━"
      );
    }

    return message.author.send(
      embed(
        "Submission Complete",
        "Your submission has been sent. Staff will review it."
      )
    );
  }

  await message.author.send(
    embed(
      `Question ${quiz.step + 1}`,
      QUESTIONS[quiz.step]
    )
  );
});

/* ================= LOGIN ================= */

client.login(TOKEN);
