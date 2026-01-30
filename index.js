console.log("🔥 SENTINEL ALLIANCE — ROBLOX AUTO-VERIFY ENABLED 🔥");

require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder
} = require("discord.js");
const noblox = require("noblox.js");

/* ===== ENV ===== */
const { TOKEN, CLIENT_ID, GUILD_ID, ROBLOX_COOKIE } = process.env;

/* ===== CLIENT ===== */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

/* ===== CONFIG ===== */
// ⬇⬇⬇ KEEP YOUR CONFIG HERE ⬇⬇⬇

/* ===== STATE ===== */
const verificationMap = new Map(); // discordId -> { robloxId, phrase }
const usedRoblox = new Set();

/* ===== HELPERS ===== */
const embed = (t, d) =>
  new EmbedBuilder().setTitle(t).setDescription(d).setColor(0x0b0b0b);

const isStaff = m =>
  m.roles.cache.some(r => CONFIG.ROLES.STAFF_ROLES.includes(r.id));

/* ===== ROBLOX LOGIN ===== */
(async () => {
  await noblox.setCookie(ROBLOX_COOKIE);
  console.log("✅ Roblox authenticated");
})();

/* ===== COMMANDS ===== */
const commands = [
  new SlashCommandBuilder().setName("verify").setDescription("Start Roblox verification"),
  new SlashCommandBuilder()
    .setName("verifycheck")
    .setDescription("Verify Roblox & accept to group")
    .addUserOption(o => o.setName("user").setRequired(true)),

  new SlashCommandBuilder()
    .setName("accept")
    .setDescription("Accept member")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o =>
      o.setName("order")
        .setDescription("sentinel / iron / rose / raven")
        .setRequired(true)
    )
];

/* ===== READY ===== */
client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(c => c.toJSON()) }
  );
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ===== INTERACTIONS ===== */
client.on("interactionCreate", async i => {

  /* ===== VERIFY START ===== */
  if (i.isChatInputCommand() && i.commandName === "verify") {
    const phrase = `${CONFIG.ROBLOX.BIO_PREFIX}${Math.floor(Math.random() * 99999)}`;

    verificationMap.set(i.user.id, { phrase });

    return i.reply({
      embeds: [
        embed(
          "Roblox Verification",
          `Put this **exact phrase** in your Roblox bio:\n\`${phrase}\`\n\nThen ask staff to verify you.`
        )
      ],
      ephemeral: true
    });
  }

  /* ===== VERIFY CHECK ===== */
  if (i.isChatInputCommand() && i.commandName === "verifycheck") {
    if (!isStaff(i.member))
      return i.reply({ content: "Staff only.", ephemeral: true });

    const user = i.options.getUser("user");
    const data = verificationMap.get(user.id);
    if (!data) return i.reply("No verification pending.");

    const robloxId = await noblox.getIdFromUsername(user.username).catch(() => null);
    if (!robloxId) return i.reply("Roblox account not found.");

    if (CONFIG.ROBLOX.ONE_ACCOUNT_ONLY && usedRoblox.has(robloxId))
      return i.reply("Roblox account already used.");

    const bio = await noblox.getBlurb(robloxId);
    if (!bio || !bio.includes(data.phrase))
      return i.reply("❌ Phrase not found in bio.");

    /* ACCEPT INTO GROUP */
    const requests = await noblox.getJoinRequests(CONFIG.ROBLOX.GROUP_ID);
    const req = requests.find(r => r.userId === robloxId);
    if (req) {
      await noblox.handleJoinRequest(CONFIG.ROBLOX.GROUP_ID, robloxId, true);
    }

    usedRoblox.add(robloxId);

    const member = await i.guild.members.fetch(user.id);
    const robloxName = await noblox.getUsernameFromId(robloxId);

    await member.setNickname(robloxName).catch(() => {});
    await member.roles.add(CONFIG.ROLES.VERIFIED).catch(() => {});
    await member.roles.remove(CONFIG.ROLES.FILTERING).catch(() => {});

    verificationMap.delete(user.id);

    return i.reply(`✅ ${user.tag} verified and accepted into Roblox group.`);
  }

  /* ===== ACCEPT ===== */
  if (i.isChatInputCommand() && i.commandName === "accept") {
    if (!isStaff(i.member)) return;

    const user = i.options.getUser("user");
    const order = i.options.getString("order").toLowerCase();
    const member = await i.guild.members.fetch(user.id);

    await member.roles.add(CONFIG.ROLES.MEMBER).catch(() => {});
    if (CONFIG.ROLES.ORDERS[order]) {
      await member.roles.add(CONFIG.ROLES.ORDERS[order]).catch(() => {});
    }

    return i.reply(`✅ Accepted ${user.tag} into ${order}.`);
  }
});

/* ===== ONE-TIME JOIN ===== */
client.on("guildMemberRemove", m => {
  m.guild.members.ban(m.id, { reason: "One-time join policy" }).catch(() => {});
});

/* ===== LOGIN ===== */
client.login(TOKEN);
