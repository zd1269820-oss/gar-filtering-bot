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

/* ================= CONFIG ================= */

const {
  TOKEN,
  CLIENT_ID,
  GUILD_ID,
  SUBMISSIONS_CHANNEL_ID
} = process.env;

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

/* ================= STORAGE ================= */

const activeQuizzes = new Map();

/* ================= HELPERS ================= */

const embed = (title, desc) =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(0x0b0b0b)
    .setTimestamp();

/* ================= QUIZ QUESTIONS ================= */

const QUIZ = [
  "Send your **Roblox profile link**.",
  "Why do you want to join **Sentinel Alliance**?",
  "Describe your clanning experience.",
  "How long have you been clanning?",
  "Do you have stats? If yes, send them. If no, say `no`."
];

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder()
    .setName("startquiz")
    .setDescription("Begin Sentinel Alliance submission quiz")
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

client.once("ready", () =>
  console.log(`🤖 Logged in as ${client.user.tag}`)
);

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "startquiz") {
    // Try to DM first
    try {
      activeQuizzes.set(i.user.id, { step: 0, answers: [] });

      await i.user.send(
        embed(
          "Sentinel Alliance Screening",
`Hello **${i.user.username}**,

This quiz is conducted **entirely in DMs**.
If you close or ignore it, you may be denied.

Please answer honestly.

**Question 1:**  
${QUIZ[0]}`
        )
      );

      return i.reply({
        content: "📩 I’ve sent you a DM. Please check it to continue.",
        ephemeral: true
      });

    } catch (err) {
      // DM failed
      const log = i.guild.channels.cache.get(SUBMISSIONS_CHANNEL_ID);
      log?.send(
        embed(
          "DM FAILED",
          `Could not DM ${i.user.tag} (${i.user.id}).\nLikely has DMs disabled.`
        )
      );

      return i.reply({
        content:
          "❌ I could not DM you.\n\nPlease enable **Allow Direct Messages from server members** in this server and try again.",
        ephemeral: true
      });
    }
  }
});

/* ================= DM HANDLER ================= */

client.on("messageCreate", async msg => {
  if (msg.guild) return;

  const quiz = activeQuizzes.get(msg.author.id);
  if (!quiz) return;

  quiz.answers.push(msg.content);
  quiz.step++;

  if (quiz.step >= QUIZ.length) {
    activeQuizzes.delete(msg.author.id);

    const ch = client.channels.cache.get(SUBMISSIONS_CHANNEL_ID);
    ch?.send(
      embed(
        "New Submission",
        `User: ${msg.author.tag}\n\n` +
        quiz.answers.map((a, i) => `**Q${i + 1}:**\n${a}`).join("\n\n")
      )
    );
    ch?.send("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNEXT APPLICANT\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return msg.author.send(
      embed(
        "Submission Complete",
        "Your submission has been received.\nStaff will review it shortly."
      )
    );
  }

  msg.author.send(
    embed(
      `Question ${quiz.step + 1}`,
      QUIZ[quiz.step]
    )
  );
});

/* ================= LOGIN ================= */

client.login(TOKEN);
