console.log("🔥 SENTINEL ALLIANCE BOT — ROBLOX VERIFY FLOW 🔥");

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
const noblox = require("noblox.js");

/* ================= CONFIG ================= */

const CONFIG = {
  ROLES: {
    VERIFIED: "VERIFIED_ROLE_ID",
    FILTERING: "FILTERING_ROLE_ID",
    STAFF: ["STAFF_ROLE_ID"]
  },

  ROBLOX: {
    BIO_PREFIX: "Sentinel-"
  }
};

/* ================= CLIENT ================= */

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

/* ================= STATE ================= */

const pendingVerifications = new Map();
let robloxEnabled = false;

/* ================= HELPERS ================= */

const embed = (t, d) =>
  new EmbedBuilder().setTitle(t).setDescription(d).setColor(0x0b0b0b);

const isStaff = m =>
  m.roles.cache.some(r => CONFIG.ROLES.STAFF.includes(r.id));

/* ================= ROBLOX LOGIN (SAFE) ================= */

(async () => {
  if (!process.env.ROBLOX_COOKIE) {
    console.log("⚠️ Roblox disabled — no cookie");
    return;
  }

  try {
    await noblox.setCookie(process.env.ROBLOX_COOKIE);
    robloxEnabled = true;
    console.log("✅ Roblox authenticated");
  } catch {
    console.log("⚠️ Roblox auth failed — continuing without Roblox");
  }
})();

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder().setName("verify").setDescription("Start Roblox verification"),
  new SlashCommandBuilder().setName("verifycheck").setDescription("Finish Roblox verification")
];

/* ================= READY ================= */

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async i => {

  /* ===== /verify ===== */
  if (i.isChatInputCommand() && i.commandName === "verify") {
    if (!robloxEnabled) {
      return i.reply({
        content: "⚠️ Roblox verification is currently unavailable.",
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("verify_modal")
      .setTitle("Roblox Verification");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("username")
          .setLabel("Roblox Username")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    return i.showModal(modal);
  }

  /* ===== VERIFY MODAL SUBMIT ===== */
  if (i.isModalSubmit() && i.customId === "verify_modal") {
    const username = i.fields.getTextInputValue("username");
    const phrase = `${CONFIG.ROBLOX.BIO_PREFIX}${Math.floor(Math.random() * 99999)}`;

    pendingVerifications.set(i.user.id, {
      username,
      phrase
    });

    return i.reply({
      embeds: [
        embed(
          "Roblox Verification",
          `Put this phrase in your Roblox bio:\n\n\`${phrase}\`\n\nThen run **/verifycheck**`
        )
      ],
      ephemeral: true
    });
  }

  /* ===== /verifycheck ===== */
  if (i.isChatInputCommand() && i.commandName === "verifycheck") {
    if (!robloxEnabled) {
      return i.reply({
        content: "⚠️ Roblox verification is currently unavailable.",
        ephemeral: true
      });
    }

    const data = pendingVerifications.get(i.user.id);
    if (!data)
      return i.reply({ content: "❌ No verification in progress.", ephemeral: true });

    const robloxId = await noblox.getIdFromUsername(data.username).catch(() => null);
    if (!robloxId)
      return i.reply({ content: "❌ Roblox user not found.", ephemeral: true });

    const bio = await noblox.getBlurb(robloxId);
    if (!bio || !bio.includes(data.phrase))
      return i.reply({ content: "❌ Phrase not found in bio.", ephemeral: true });

    const member = await i.guild.members.fetch(i.user.id);

    await member.roles.add(CONFIG.ROLES.VERIFIED).catch(()=>{});
    await member.roles.remove(CONFIG.ROLES.FILTERING).catch(()=>{});
    await member.setNickname(data.username).catch(()=>{});

    pendingVerifications.delete(i.user.id);

    return i.reply({
      content: "✅ Verification successful. Welcome.",
      ephemeral: true
    });
  }
});

/* ================= LOGIN ================= */

client.login(process.env.TOKEN);
