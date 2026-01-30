require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* ================= SETTINGS ================= */

const VERIFIED_ROLE = "Verified";
const STAFF_ROLE = "Staff";
const LOG_CHANNEL = "mod-logs";

/* Role Packages (Configurable) */
const PACKAGES = {
  "order of rose": ["Order of Rose", "Company"],
  "order of iron": ["Order of Iron", "Company"],
  "order of sentinel": ["Order of Sentinel", "Company"],
  "scrim main": ["Scrim Team", "Main"],
  "scrim reserve": ["Scrim Team", "Reserve"]
};

/* Quotes */
const QUOTES = [
  "🛡️ Honor is the shield of the Sentinel.",
  "For the Order. For the Sentinel Alliance.",
  "Strength without discipline is nothing.",
  "Stand proud, Sentinel. The faction watches.",
  "A true warrior does not fear the test."
];

/* ================= COMMANDS ================= */

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Test bot"),

  new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Get Verified role"),

  new SlashCommandBuilder()
    .setName("package")
    .setDescription("Give a role package")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Target").setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName("name")
        .setDescription("Package name (order of rose etc)")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Send ticket panel (Staff only)"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn user (Staff only)")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Target").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("reason").setDescription("Reason").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick user")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Target").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban user")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Target").setRequired(true)
    )
];

/* ================= READY ================= */

client.once("ready", async () => {
  console.log(`✅ Sentinel Online: ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands.map(cmd => cmd.toJSON()) }
  );

  console.log("✅ Commands Registered!");

  /* Auto Quotes */
  setInterval(() => {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const channel = guild.channels.cache.find(c => c.name === "general");
    if (!channel) return;

    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

    channel.send(`📜 **Sentinel Wisdom**\n${quote}`);
  }, 1000 * 60 * 60); // every hour
});

/* ================= LOG FUNCTION ================= */

function log(guild, msg) {
  const channel = guild.channels.cache.find(c => c.name === LOG_CHANNEL);
  if (channel) channel.send(msg);
}

/* ================= ALT DETECTION ================= */

client.on("guildMemberAdd", member => {
  const ageDays =
    (Date.now() - member.user.createdTimestamp) /
    (1000 * 60 * 60 * 24);

  if (ageDays < 7) {
    log(
      member.guild,
      `⚠️ Possible Alt: ${member.user.tag} (${ageDays.toFixed(1)} days old)`
    );
  }
});

/* ================= INTERACTIONS ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;
  const embed = new EmbedBuilder().setColor(0x00ff99);

  /* /ping */
  if (cmd === "ping") {
    embed.setTitle("🏓 Pong!").setDescription("Sentinel is online.");
    return interaction.reply({ embeds: [embed] });
  }

  /* /verify */
  if (cmd === "verify") {
    const role = interaction.guild.roles.cache.find(
      r => r.name === VERIFIED_ROLE
    );

    if (!role)
      return interaction.reply("❌ Verified role missing.");

    await interaction.member.roles.add(role);

    embed.setTitle("✅ Verified!")
      .setDescription("Welcome to the Sentinel Alliance.");

    return interaction.reply({ embeds: [embed] });
  }

  /* /package */
  if (cmd === "package") {
    const staffRole = interaction.guild.roles.cache.find(
      r => r.name === STAFF_ROLE
    );

    if (!interaction.member.roles.cache.has(staffRole.id))
      return interaction.reply("❌ Staff only.");

    const user = interaction.options.getMember("user");
    const name = interaction.options.getString("name").toLowerCase();

    if (!PACKAGES[name])
      return interaction.reply("❌ Package not found.");

    for (const roleName of PACKAGES[name]) {
      const role = interaction.guild.roles.cache.find(
        r => r.name === roleName
      );
      if (role) await user.roles.add(role);
    }

    embed.setTitle("🎖️ Package Applied")
      .setDescription(`Gave **${name}** roles to ${user.user.tag}`);

    log(interaction.guild, `✅ Package ${name} → ${user.user.tag}`);

    return interaction.reply({ embeds: [embed] });
  }

  /* /ticketpanel */
  if (cmd === "ticketpanel") {
    const staffRole = interaction.guild.roles.cache.find(
      r => r.name === STAFF_ROLE
    );

    if (!interaction.member.roles.cache.has(staffRole.id))
      return interaction.reply("❌ Staff only.");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel("🎫 Open Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    embed.setTitle("🎫 Sentinel Support")
      .setDescription("Press below to open a ticket.");

    return interaction.reply({ embeds: [embed], components: [row] });
  }

  /* /warn */
  if (cmd === "warn") {
    const staffRole = interaction.guild.roles.cache.find(
      r => r.name === STAFF_ROLE
    );

    if (!interaction.member.roles.cache.has(staffRole.id))
      return interaction.reply("❌ Staff only.");

    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");

    embed.setTitle("⚠️ Warning Issued")
      .setDescription(`${user.tag} warned.`)
      .addFields({ name: "Reason", value: reason });

    log(interaction.guild, `⚠️ Warned ${user.tag}: ${reason}`);

    return interaction.reply({ embeds: [embed] });
  }

  /* /kick */
  if (cmd === "kick") {
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.KickMembers
      )
    )
      return interaction.reply("❌ No permission.");

    const member = interaction.options.getMember("user");
    await member.kick();

    return interaction.reply(`👢 Kicked ${member.user.tag}`);
  }

  /* /ban */
  if (cmd === "ban") {
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.BanMembers
      )
    )
      return interaction.reply("❌ No permission.");

    const member = interaction.options.getMember("user");
    await member.ban();

    return interaction.reply(`🔨 Banned ${member.user.tag}`);
  }
});

/* ================= TICKET BUTTON ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "ticket_open") {
    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });

    channel.send(`🎫 Ticket opened by ${interaction.user}`);

    return interaction.reply({
      content: `✅ Ticket created: ${channel}`,
      ephemeral: true
    });
  }
});

/* ================= START ================= */

client.login(process.env.TOKEN);
