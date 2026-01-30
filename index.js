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
  OWNER_ID
} = process.env;

const STAFF_ROLE_IDS = [
  "STAFF_ROLE_ID_1",
  "STAFF_ROLE_ID_2"
];

const FILTERING_ROLE_ID = "FILTERING_ROLE_ID";
const VERIFIED_ROLE_ID = "VERIFIED_ROLE_ID";

/* ================= STORAGE ================= */

const linkedAccounts = new Map();       // discordId -> robloxId
const verificationRequests = new Map(); // discordId -> { robloxId, phrase }

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

/* ================= ROBLOX ================= */

(async () => {
  try {
    await noblox.setCookie(process.env.ROBLOX_COOKIE);
    console.log("✅ Roblox authenticated");
  } catch (e) {
    console.error("❌ Roblox auth failed", e);
  }
})();

/* ================= HELPERS ================= */

const isStaff = member => {
  if (member.id === OWNER_ID) return true;
  return member.roles.cache.some(r => STAFF_ROLE_IDS.includes(r.id));
};

const embed = (title, desc) =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(0x0b0b0b)
    .setTimestamp();

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot status"),

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
    .setDescription("Begin Roblox verification"),

  new SlashCommandBuilder()
    .setName("confirmverify")
    .setDescription("Confirm a user's Roblox verification")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("User to verify")
        .setRequired(true)
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

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  /* PING */
  if (i.commandName === "ping")
    return i.reply(`🏓 Pong`);

  /* LINK ROBLOX */
  if (i.commandName === "linkroblox") {
    try {
      const robloxId = await noblox.getIdFromUsername(
        i.options.getString("username")
      );
      linkedAccounts.set(i.user.id, robloxId);

      return i.reply({
        embeds: [
          embed(
            "Roblox Linked",
            `Your Roblox account has been linked.\n\nNext step: **/verify**`
          )
        ],
        ephemeral: true
      });
    } catch {
      return i.reply({ content: "❌ Roblox user not found.", ephemeral: true });
    }
  }

  /* VERIFY */
  if (i.commandName === "verify") {
    const robloxId = linkedAccounts.get(i.user.id);
    if (!robloxId)
      return i.reply({ content: "❌ Link Roblox first using /linkroblox", ephemeral: true });

    const phrase = `Sentinel-${Math.floor(Math.random() * 100000)}`;
    verificationRequests.set(i.user.id, { robloxId, phrase });

    return i.reply({
      embeds: [
        embed(
          "Verification Step",
          `Put this **exact text** in your Roblox bio:\n\n\`\`\`${phrase}\`\`\`\nThen ask staff to run **/confirmverify** on you.`
        )
      ],
      ephemeral: true
    });
  }

  /* CONFIRM VERIFY */
  if (i.commandName === "confirmverify") {
    if (!isStaff(i.member))
      return i.reply({ content: "❌ Staff only.", ephemeral: true });

    const user = i.options.getUser("user");
    const request = verificationRequests.get(user.id);

    if (!request)
      return i.reply("❌ No pending verification.");

    const { robloxId, phrase } = request;
    const bio = await noblox.getBlurb(robloxId);

    if (!bio || !bio.includes(phrase))
      return i.reply("❌ Verification phrase not found in Roblox bio.");

    verificationRequests.delete(user.id);

    const member = await i.guild.members.fetch(user.id);

    await member.roles.remove(FILTERING_ROLE_ID).catch(() => {});
    await member.roles.add(VERIFIED_ROLE_ID).catch(() => {});

    return i.reply({
      embeds: [
        embed(
          "Verification Complete",
          `${user.tag} has been successfully verified.`
        )
      ]
    });
  }
});

/* ================= JOIN ================= */

client.on("guildMemberAdd", async member => {
  await member.roles.add(FILTERING_ROLE_ID).catch(() => {});
  try {
    await member.send(
      embed(
        "Welcome",
        "You are now in **filtering**.\n\nLink Roblox with **/linkroblox** to begin verification."
      )
    );
  } catch {}
});

/* ================= SAFETY ================= */

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

client.login(TOKEN);
