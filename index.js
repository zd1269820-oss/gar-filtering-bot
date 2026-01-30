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

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const SUBMISSIONS_CHANNEL_ID = process.env.SUBMISSIONS_CHANNEL_ID;

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

/* ================= QUIZ ================= */

const QUESTIONS = [
  "Send your **Roblox profile link**.",
  "Why do you want to join **Sentinel Alliance**?",
  "Describe your clanning experience.",
  "How long have you been clanning?",
  "Do you have stats? If yes, send them. If no, type `no`."
];

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder()
    .setName("startquiz")
    .setDescription("Begin Sentinel Alliance quiz"),

  new SlashCommandBuilder()
    .setName("retrydm")
    .setDescription("Retry DM if it failed"),

  new SlashCommandBuilder()
    .setName("accept")
    .setDescription("Accept applicant")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("deny")
    .setDescription("Deny applicant")
    .addUserOption(o =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason").setRequired(true)
    )
];

/* ================= DEPLOY (CLEARS OLD COMMANDS) ================= */

(async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  // wipe guild + global commands
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });

  // register fresh
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log("✅ Commands wiped and re-registered clean");
})();

/* ================= READY ================= */

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  /* START QUIZ */
  if (i.commandName === "startquiz" || i.commandName === "retrydm") {
    activeQuizzes.delete(i.user.id);

    try {
      activeQuizzes.set(i.user.id, { step: 0, answers: [] });

      await i.user.send(
        embed(
          "Sentinel Alliance Screening",
`Hello **${i.user.username}**,

This quiz is conducted in DMs.
Abuse or spam results in a ban.

**Question 1:**  
${QUESTIONS[0]}`
        )
      );

      return i.reply({
        content: "📩 Check your DMs to continue.",
        ephemeral: true
      });

    } catch {
      activeQuizzes.delete(i.user.id);
      return i.reply({
        content:
          "❌ I cannot DM you.\nEnable **Allow DMs from server members**, restart Discord, then try again.",
        ephemeral: true
      });
    }
  }

  /* ACCEPT */
  if (i.commandName === "accept") {
    const user = i.options.getUser("user");
    await user.send(embed("Accepted", "You have been accepted into Sentinel Alliance."));
    return i.reply(`✅ ${user.tag} accepted.`);
  }

  /* DENY */
  if (i.commandName === "deny") {
    const user = i.options.getUser("user");
    const reason = i.options.getString("reason");
    await user.send(embed("Denied", `Reason:\n${reason}`));
    return i.reply(`❌ ${user.tag} denied.`);
  }
});

/* ================= DM HANDLER ================= */

client.on("messageCreate", async msg => {
  if (msg.guild) return;

  const quiz = activeQuizzes.get(msg.author.id);
  if (!quiz) return;

  quiz.answers.push(msg.content);
  quiz.step++;

  if (quiz.step >= QUESTIONS.length) {
    activeQuizzes.delete(msg.author.id);

    const ch = client.channels.cache.get(SUBMISSIONS_CHANNEL_ID);
    ch?.send(
      embed(
        "New Submission",
        `User: ${msg.author.tag}\n\n` +
        quiz.answers.map((a, i) => `**Q${i + 1}:**\n${a}`).join("\n\n")
      )
    );
    ch?.send("━━━━━━━━━━━━━━━━━━━━━━\nNEXT APPLICANT\n━━━━━━━━━━━━━━━━━━━━━━");

    return msg.author.send(
      embed("Complete", "Your submission has been sent.")
    );
  }

  msg.author.send(
    embed(`Question ${quiz.step + 1}`, QUESTIONS[quiz.step])
  );
});

/* ================= LOGIN ================= */

client.login(TOKEN);
