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
const ACCEPTED_ROLES = ["ACCEPTED_ROLE_1"];
const STAFF_ROLE_IDS = ["STAFF_ROLE_ID_1"];

/* SETTINGS */
const QUIZ_COOLDOWN_MS = 48 * 60 * 60 * 1000;

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

const quizCooldowns = new Map();        // discordId -> timestamp
const activeQuizzes = new Map();        // discordId -> { step, answers }
const linkedAccounts = new Map();       // discordId -> robloxId
const lockedRoblox = new Set();         // robloxId (one-time)

/* ================= HELPERS ================= */

const isStaff = m =>
  m.id === OWNER_ID ||
  m.roles.cache.some(r => STAFF_ROLE_IDS.includes(r.id));

const embed = (t, d) =>
  new EmbedBuilder().setTitle(t).setDescription(d).setColor(0x0b0b0b).setTimestamp();

/* ================= QUIZ QUESTIONS ================= */

const QUIZ = [
  { key: "profile", q: "Send your **Roblox profile link**." },
  { key: "why", q: "Why do you want to join **Sentinel Alliance**?" },
  { key: "experience", q: "Describe your clanning experience." },
  { key: "time", q: "How long have you been clanning?" },
  { key: "stats", q: "Do you have verified stats? (Yes / No)" },
  { key: "statsProof", q: "Send your stats (or type `none`)." }
];

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder().setName("startquiz").setDescription("Begin submission quiz"),

  new SlashCommandBuilder()
    .setName("linkroblox")
    .setDescription("Link Roblox account")
    .addStringOption(o =>
      o.setName("username").setDescription("Roblox username").setRequired(true)
    ),

  new SlashCommandBuilder().setName("verify").setDescription("Begin Roblox verification"),

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
    const last = quizCooldowns.get(i.user.id);
    if (last && Date.now() - last < QUIZ_COOLDOWN_MS)
      return i.reply({ content: "❌ You must wait 48 hours before retrying.", ephemeral: true });

    quizCooldowns.set(i.user.id, Date.now());
    activeQuizzes.set(i.user.id, { step: -1, answers: {} });

    await i.reply({ content: "📩 Check your DMs to begin.", ephemeral: true });

    return i.user.send(
      embed(
        "Sentinel Alliance Screening",
`Hello **${i.user.username}**.

This quiz may only be taken **once every 48 hours**.
Abuse or bypass attempts result in a **permanent ban**.

When ready, reply with:
\`ready\``
      )
    );
  }

  /* LINK ROBLOX */
  if (i.commandName === "linkroblox") {
    const id = await noblox.getIdFromUsername(i.options.getString("username"));
    if (lockedRoblox.has(id))
      return i.reply({ content: "❌ This Roblox account is already locked.", ephemeral: true });

    linkedAccounts.set(i.user.id, id);
    lockedRoblox.add(id);
    return i.reply({ content: "🔗 Roblox linked. Run `/verify`.", ephemeral: true });
  }

  /* VERIFY */
  if (i.commandName === "verify") {
    const robloxId = linkedAccounts.get(i.user.id);
    if (!robloxId)
      return i.reply({ content: "❌ Link Roblox first.", ephemeral: true });

    const phrase = `Sentinel-${Math.floor(Math.random() * 99999)}`;
    await i.reply({
      embeds: [embed("Verification", `Put this in your Roblox bio:\n\`${phrase}\``)],
      ephemeral: true
    });

    setTimeout(async () => {
      const bio = await noblox.getBlurb(robloxId);
      if (!bio || !bio.includes(phrase)) return;

      const username = await noblox.getUsernameFromId(robloxId);
      const member = await i.guild.members.fetch(i.user.id);

      await member.setNickname(username).catch(() => {});
      await member.roles.remove(FILTERING_ROLE_ID).catch(() => {});
      await member.roles.add(VERIFIED_ROLE_ID).catch(() => {});
    }, 15000);
  }

  /* STAFF ACCEPT */
  if (i.commandName === "accept") {
    if (!isStaff(i.member)) return i.reply("❌ Staff only.");
    const user = i.options.getUser("user");
    const member = await i.guild.members.fetch(user.id);

    for (const r of ACCEPTED_ROLES)
      await member.roles.add(r).catch(() => {});

    await user.send(embed("Accepted", "You have been accepted into Sentinel Alliance."));
    return i.reply(`✅ ${user.tag} accepted.`);
  }

  /* STAFF DENY */
  if (i.commandName === "deny") {
    if (!isStaff(i.member)) return i.reply("❌ Staff only.");
    const user = i.options.getUser("user");
    const reason = i.options.getString("reason");

    await user.send(embed("Denied", `Reason:\n${reason}`));
    return i.reply(`❌ ${user.tag} denied.`);
  }
});

/* ================= DM QUIZ HANDLER ================= */

client.on("messageCreate", async msg => {
  if (msg.guild) return;
  const quiz = activeQuizzes.get(msg.author.id);
  if (!quiz) return;

  if (quiz.step === -1) {
    if (msg.content.toLowerCase() !== "ready")
      return msg.author.send(embed("Waiting", "Type `ready` to begin."));
    quiz.step = 0;
    return msg.author.send(embed("Question 1", QUIZ[0].q));
  }

  const q = QUIZ[quiz.step];
  quiz.answers[q.key] = msg.content;
  quiz.step++;

  if (quiz.step >= QUIZ.length) {
    activeQuizzes.delete(msg.author.id);

    const ch = client.channels.cache.get(SUBMISSIONS_CHANNEL_ID);
    ch?.send(
      embed(
        "New Submission",
        `User: ${msg.author.tag}\n\n` +
        QUIZ.map(x => `**${x.key.toUpperCase()}**:\n${quiz.answers[x.key]}`).join("\n\n")
      )
    );
    ch?.send("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNEXT APPLICANT\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return msg.author.send(embed("Complete", "Your submission has been sent."));
  }

  msg.author.send(embed(`Question ${quiz.step + 1}`, QUIZ[quiz.step].q));
});

/* ================= JOIN / LEAVE ================= */

client.on("guildMemberAdd", async m => {
  await m.roles.add(FILTERING_ROLE_ID).catch(() => {});
});

client.on("guildMemberRemove", async m => {
  try {
    await m.send(
      embed(
        "Banned",
        "You left the server.\nSentinel Alliance enforces a **one-time join policy**.\nYou are now permanently banned."
      )
    );
  } catch {}
  await m.guild.members.ban(m.id, { reason: "One-time join policy" });
});

/* ================= LOGIN ================= */

client.login(TOKEN);
