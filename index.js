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
const noblox = require("noblox.js");

/* ================= CONFIG ================= */

const {
  TOKEN,
  CLIENT_ID,
  GUILD_ID,
  OWNER_ID,
  ROBLOX_COOKIE,
  SUBMISSIONS_CHANNEL_ID
} = process.env;

/* ROLES — EDIT THESE */
const FILTERING_ROLE_ID = "FILTERING_ROLE_ID";
const VERIFIED_ROLE_ID = "VERIFIED_ROLE_ID";
const STAFF_ROLE_IDS = ["STAFF_ROLE_ID_1"];

/* QUIZ SETTINGS */
const QUIZ_COOLDOWN_MS = 48 * 60 * 60 * 1000; // 2 days

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

/* ================= ROBLOX ================= */

(async () => {
  await noblox.setCookie(ROBLOX_COOKIE);
  console.log("✅ Roblox authenticated");
})();

/* ================= STORAGE ================= */

const activeQuizzes = new Map();   // discordId -> { step, answers }
const quizCooldowns = new Map();   // discordId -> timestamp

/* ================= HELPERS ================= */

const embed = (title, desc) =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(0x0b0b0b)
    .setTimestamp();

/* ================= QUIZ QUESTIONS ================= */
/* 👉 EDIT THIS ARRAY TO ADD / REMOVE QUESTIONS */

const QUIZ = [
  { key: "profile", question: "Send your **Roblox profile link**." },
  { key: "why", question: "Why do you want to join **Sentinel Alliance**?" },
  { key: "experience", question: "Describe your clanning experience." },
  { key: "time", question: "How long have you been clanning?" }
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
    const now = Date.now();
    const last = quizCooldowns.get(i.user.id);

    /* COOLDOWN CHECK */
    if (last && now - last < QUIZ_COOLDOWN_MS) {
      return i.reply({
        content: "❌ You have already submitted a quiz in the last **48 hours**.",
        ephemeral: true
      });
    }

    /* ACTIVE QUIZ CHECK */
    if (activeQuizzes.has(i.user.id)) {
      return i.reply({
        content: "❌ You already have an active quiz in progress.",
        ephemeral: true
      });
    }

    quizCooldowns.set(i.user.id, now);
    activeQuizzes.set(i.user.id, { step: -1, answers: {} });

    await i.reply({
      content: "📩 Check your DMs to begin the quiz.",
      ephemeral: true
    });

    /* INTRO DM */
    return i.user.send(
      embed(
        "Sentinel Alliance Screening",
`Hello **${i.user.username}**,

Welcome to the Sentinel Alliance submission process.

This is a **one-time quiz per 48 hours**.
Attempting to bypass, spam, or abuse this system will result in a **permanent ban**.

Be honest and detailed — your answers determine placement.

When you are ready, **reply with:**
\`ready\``
      )
    );
  }
});

/* ================= DM QUIZ HANDLER ================= */

client.on("messageCreate", async msg => {
  if (msg.guild) return;

  const quiz = activeQuizzes.get(msg.author.id);
  if (!quiz) return;

  /* WAIT FOR READY */
  if (quiz.step === -1) {
    if (msg.content.toLowerCase() !== "ready") {
      return msg.author.send(
        embed(
          "Waiting for Confirmation",
          "Type **ready** when you are prepared to begin."
        )
      );
    }

    quiz.step = 0;
    return msg.author.send(
      embed(
        "Question 1",
        QUIZ[0].question
      )
    );
  }

  /* RECORD ANSWER */
  const q = QUIZ[quiz.step];
  quiz.answers[q.key] = msg.content;
  quiz.step++;

  /* QUIZ COMPLETE */
  if (quiz.step >= QUIZ.length) {
    activeQuizzes.delete(msg.author.id);

    const ch = client.channels.cache.get(SUBMISSIONS_CHANNEL_ID);
    ch?.send(
      embed(
        "New DM Submission",
        `User: ${msg.author.tag}\n\n` +
        QUIZ.map(q => `**${q.key.toUpperCase()}**:\n${quiz.answers[q.key]}`).join("\n\n")
      )
    );

    return msg.author.send(
      embed(
        "Submission Complete",
        "Your responses have been submitted.\nStaff will review your application."
      )
    );
  }

  /* NEXT QUESTION */
  msg.author.send(
    embed(
      `Question ${quiz.step + 1}`,
      QUIZ[quiz.step].question
    )
  );
});

/* ================= JOIN / LEAVE ================= */

client.on("guildMemberAdd", async member => {
  await member.roles.add(FILTERING_ROLE_ID).catch(() => {});
  try {
    await member.send(
      embed(
        "Welcome to Sentinel Alliance",
        "You are now in **filtering**.\nRun **/startquiz** to begin your submission."
      )
    );
  } catch {}
});

client.on("guildMemberRemove", async member => {
  try {
    await member.send(
      embed(
        "You Have Been Banned",
        "Sentinel Alliance enforces a **one-time join policy**.\n\nYou have been permanently banned.\nAppeals may be submitted through staff."
      )
    );
  } catch {}

  await member.guild.members.ban(member.id, {
    reason: "One-time join policy enforced"
  });
});

/* ================= LOGIN ================= */

client.login(TOKEN);
