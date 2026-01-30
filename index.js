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

/* ROLES — CHANGE THESE */
const FILTERING_ROLE_ID = "FILTERING_ROLE_ID";
const VERIFIED_ROLE_ID = "VERIFIED_ROLE_ID";
const POST_VERIFY_ROLES = ["ROLE_AFTER_VERIFY_1"];
const STAFF_ROLE_IDS = ["STAFF_ROLE_ID_1"];

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

const linkedAccounts = new Map();   // discordId -> robloxId
const lockedRoblox = new Set();     // robloxId (one-time)
const activeQuizzes = new Map();    // discordId -> { step, answers }

/* ================= HELPERS ================= */

const isStaff = member =>
  member.id === OWNER_ID ||
  member.roles.cache.some(r => STAFF_ROLE_IDS.includes(r.id));

const embed = (t, d) =>
  new EmbedBuilder().setTitle(t).setDescription(d).setColor(0x0b0b0b);

/* ================= QUIZ QUESTIONS ================= */
/* 👉 EDIT THESE TO ADD / REMOVE QUESTIONS */

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
    .setDescription("Begin Sentinel Alliance submission quiz"),

  new SlashCommandBuilder()
    .setName("linkroblox")
    .setDescription("Link your Roblox account")
    .addStringOption(o =>
      o.setName("username")
        .setDescription("Your Roblox username")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Begin Roblox verification")
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

  /* START QUIZ */
  if (i.commandName === "startquiz") {
    activeQuizzes.set(i.user.id, { step: 0, answers: {} });

    await i.reply({ content: "📩 Check your DMs to begin.", ephemeral: true });

    return i.user.send(
      embed(
        "Sentinel Alliance Submission",
        QUIZ[0].question
      )
    );
  }

  /* LINK ROBLOX */
  if (i.commandName === "linkroblox") {
    const username = i.options.getString("username");
    const robloxId = await noblox.getIdFromUsername(username);

    if (lockedRoblox.has(robloxId))
      return i.reply({ content: "❌ This Roblox account is already locked.", ephemeral: true });

    linkedAccounts.set(i.user.id, robloxId);
    lockedRoblox.add(robloxId);

    return i.reply({
      embeds: [embed("Roblox Linked", "Now run **/verify**")],
      ephemeral: true
    });
  }

  /* VERIFY */
  if (i.commandName === "verify") {
    const robloxId = linkedAccounts.get(i.user.id);
    if (!robloxId)
      return i.reply({ content: "❌ Link Roblox first.", ephemeral: true });

    const phrase = `Sentinel-${Math.floor(Math.random() * 100000)}`;

    return i.reply({
      embeds: [
        embed(
          "Verification Step",
          `Put this **exact text** in your Roblox bio:\n\n\`${phrase}\`\`\nThen notify staff.`
        )
      ],
      ephemeral: true
    });
  }
});

/* ================= DM QUIZ HANDLER ================= */

client.on("messageCreate", async msg => {
  if (msg.guild) return;
  const quiz = activeQuizzes.get(msg.author.id);
  if (!quiz) return;

  const q = QUIZ[quiz.step];
  quiz.answers[q.key] = msg.content;
  quiz.step++;

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
        "Your submission has been sent. Staff will review it."
      )
    );
  }

  msg.author.send(embed("Next Question", QUIZ[quiz.step].question));
});

/* ================= JOIN / LEAVE ================= */

client.on("guildMemberAdd", async member => {
  await member.roles.add(FILTERING_ROLE_ID).catch(() => {});
  try {
    await member.send(
      embed(
        "Welcome to Sentinel Alliance",
        "You are now in filtering.\nRun **/startquiz** to begin."
      )
    );
  } catch {}
});

client.on("guildMemberRemove", async member => {
  try {
    await member.send(
      embed(
        "You Have Been Banned",
        "Sentinel Alliance enforces a **one-time join policy**.\n\nYou have been permanently banned.\nAppeals must be made to staff."
      )
    );
  } catch {}

  await member.guild.members.ban(member.id, {
    reason: "One-time join policy enforced"
  });
});

/* ================= LOGIN ================= */

client.login(TOKEN);
