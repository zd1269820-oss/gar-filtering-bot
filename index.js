require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ===== SETTINGS ===== */
const STAFF_ROLE = "Staff";
const VERIFIED_ROLE = "Verified";
const LOG_CHANNEL = "mod-logs";

/* ===== WARN STORAGE ===== */
let warns = new Map();

/* ===== COMMANDS ===== */
const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Test bot"),

  new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Get Verified role"),

  new SlashCommandBuilder()
    .setName("altcheck")
    .setDescription("Alt detection scan")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Target user").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user (Staff only)")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Target").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Target").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Target").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Lock current channel")
];

/* ===== DEPLOY COMMANDS AUTO ===== */
client.once("ready", async () => {
  console.log(`✅ Sentinel Online as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands.map(cmd => cmd.toJSON()) }
  );

  console.log("✅ Slash Commands Registered!");
});

/* ===== LOG FUNCTION ===== */
function log(guild, text) {
  const channel = guild.channels.cache.find(c => c.name === LOG_CHANNEL);
  if (channel) channel.send(text);
}

/* ===== ALT DETECTION JOIN ===== */
client.on("guildMemberAdd", member => {
  const ageDays =
    (Date.now() - member.user.createdTimestamp) /
    (1000 * 60 * 60 * 24);

  if (ageDays < 7) {
    log(
      member.guild,
      `⚠️ **ALT WARNING**\nUser: ${member.user.tag}\nAccount Age: ${ageDays.toFixed(
        1
      )} days`
    );
  } else {
    log(member.guild, `✅ Member Joined: ${member.user.tag}`);
  }
});

/* ===== ANTI SPAM ===== */
let spamMap = new Map();

client.on("messageCreate", msg => {
  if (msg.author.bot) return;

  let count = spamMap.get(msg.author.id) || 0;
  spamMap.set(msg.author.id, count + 1);

  setTimeout(() => spamMap.delete(msg.author.id), 5000);

  if (count > 6) {
    msg.member.timeout(5 * 60 * 1000, "Spam detected");
    log(msg.guild, `🚫 Spam Timeout: ${msg.author.tag}`);
  }
});

/* ===== COMMAND HANDLER ===== */
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;

  /* EMBED STYLE */
  const embed = new EmbedBuilder().setColor(0x00ff99);

  /* /ping */
  if (name === "ping") {
    embed.setTitle("🏓 Pong!")
      .setDescription("Sentinel is alive and watching.");

    return interaction.reply({ embeds: [embed] });
  }

  /* /verify */
  if (name === "verify") {
    const role = interaction.guild.roles.cache.find(
      r => r.name === VERIFIED_ROLE
    );

    if (!role)
      return interaction.reply("❌ Verified role missing.");

    await interaction.member.roles.add(role);

    embed.setTitle("✅ Verified")
      .setDescription("You have been verified successfully.");

    return interaction.reply({ embeds: [embed] });
  }

  /* /altcheck */
  if (name === "altcheck") {
    const user = interaction.options.getUser("user");

    const ageDays =
      (Date.now() - user.createdTimestamp) /
      (1000 * 60 * 60 * 24);

    embed.setTitle("🕵️ Alt Scan Complete")
      .addFields(
        { name: "User", value: user.tag },
        { name: "Account Age", value: `${ageDays.toFixed(1)} days` }
      );

    return interaction.reply({ embeds: [embed] });
  }

  /* /warn */
  if (name === "warn") {
    const staff = interaction.guild.roles.cache.find(
      r => r.name === STAFF_ROLE
    );

    if (!interaction.member.roles.cache.has(staff.id))
      return interaction.reply("❌ Staff only.");

    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

    warns.set(user.id, (warns.get(user.id) || 0) + 1);

    embed.setTitle("⚠️ Warning Issued")
      .setDescription(`${user.tag} has been warned.`)
      .addFields(
        { name: "Reason", value: reason },
        { name: "Total Warns", value: `${warns.get(user.id)}` }
      );

    log(interaction.guild, `⚠️ Warned ${user.tag}: ${reason}`);

    return interaction.reply({ embeds: [embed] });
  }

  /* /kick */
  if (name === "kick") {
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.KickMembers
      )
    )
      return interaction.reply("❌ No permission.");

    const member = interaction.options.getMember("user");
    await member.kick();

    embed.setTitle("👢 User Kicked")
      .setDescription(`${member.user.tag} was kicked.`);

    return interaction.reply({ embeds: [embed] });
  }

  /* /ban */
  if (name === "ban") {
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.BanMembers
      )
    )
      return interaction.reply("❌ No permission.");

    const member = interaction.options.getMember("user");
    await member.ban();

    embed.setTitle("🔨 User Banned")
      .setDescription(`${member.user.tag} was banned.`);

    return interaction.reply({ embeds: [embed] });
  }

  /* /lockdown */
  if (name === "lockdown") {
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    )
      return interaction.reply("❌ No permission.");

    await interaction.channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      { SendMessages: false }
    );

    embed.setTitle("🔒 Lockdown Enabled")
      .setDescription("Channel has been locked.");

    return interaction.reply({ embeds: [embed] });
  }
});

/* ===== START BOT ===== */
client.login(process.env.TOKEN);
