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
  OWNER_ID,
  SUBMISSIONS_CHANNEL_ID
} = process.env;

/* SETTINGS */
const QUIZ_COOLDOWN_MS = 48 * 60 * 60 * 1000; // 48h

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

// userId -> { step, answers }
const activeQuizzes = new Map();

// userId -> lastQuizTimestamp
const quizCooldowns = new Map();

/* ================= HELPERS ================= */

const embed = (title, desc) =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(0x0b0b0b)
    .setTimestamp();

const isOwnerOrStaff = (member) =>
  member?.id === OWNER_ID || member?.permissions?.has?.("Administrator");

/* ================= QUIZ QUESTIONS ================= */

const QUIZ = [
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
    .setDescription("Begin Sentinel Alliance submission quiz")
    .addStringOption(o =>
      o.setName("force")
        .setDescription("Force start (staff/owner only)")
        .addChoices({ name: "force", value: "force" })
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("retrydm")
    .setDescription("Retry the quiz DM if it failed")
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
});

/* ================= DM STARTER ================= */

async function startQuizDM(user, guild, forced = false) {
  // Always clear any stale state before attempting
  activeQuizzes.delete(user.id);

  try {
    activeQuizzes.set(user.id, { step: 0, answers: [] });

    await user.send(
      embed(
        "Sentinel Alliance Screening",
`Hello **${user.username}**,

This quiz is conducted **entirely in DMs**.
• One attempt every **48 hours**
• Abuse or bypass attempts = **ban**

**Question 1:**  
${QUIZ[0]}`
      )
    );

    return true;
  } catch (err) {
    // DM failed — clean up state and log
    activeQuizzes.delete(user.id);

    const log = guild.channels.cache.get(SUBMISSIONS_CHANNEL_ID);
    log?.send(
      embed(
        "DM FAILED",
        `Could not DM **${user.tag}** (${user.id}).\nLikely DMs disabled or bot blocked.`
      )
    );

    return false;
  }
}

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  /* START QUIZ */
  if (i.commandName === "startquiz") {
    const forceFlag = i.options.getString("force") === "force";
    const now = Date.now();
    const last = quizCooldowns.get(i.user.id);

    if (!forceFlag && last && now - last < QUIZ_COOLDOWN_MS) {
      return i.reply({
        content: "❌ You’ve already taken the quiz in the last **48 hours**.",
        ephemeral: true
      });
    }

    if (forceFlag && !isOwnerOrStaff(i.member)) {
      return i.reply({ content: "❌ Staff/Owner only.", ephemeral: true });
    }

    quizCooldowns.set(i.user.id, now);

    const ok = await startQuizDM(i.user, i.guild, forceFlag);

    if (!ok) {
      return i.reply({
        content:
          "❌ I couldn’t DM you.\n\nEnable **Allow Direct Messages from server members**, then run **/retrydm**.",
        ephemeral: true
      });
    }

    return i.reply({
      content: "📩 I’ve sent you a DM. Please check it to continue.",
      ephemeral: true
    });
  }

  /* RETRY DM */
  if (i.commandName === "retrydm") {
    const ok = await startQuizDM(i.user, i.guild, true);

    if (!ok) {
      return i.reply({
        content:
          "❌ Still can’t DM you.\n\nCheck:\n• Server → Privacy → Allow DMs\n• You haven’t blocked the bot\n• Restart Discord\n\nThen try again.",
        ephemeral: true
      });
    }

    return i.reply({
      content: "📩 DM sent. Please check your messages.",
      ephemeral: true
    });
  }
});

/* ================= DM QUIZ HANDLER ================= */

client.on("messageCreate", async (msg) => {
  if (msg.guild) return;

  const quiz = activeQuizzes.get(msg.author.id);
  if (!quiz) return;

  // Record answer
  quiz.answers.push(msg.content);
  quiz.step++;

  // Finished
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
        "Your submission has been received. Staff will review it."
      )
    );
  }

  // Next question
  return msg.author.send(
    embed(`Question ${quiz.step + 1}`, QUIZ[quiz.step])
  );
});

/* ================= LOGIN ================= */

client.login(TOKEN);
