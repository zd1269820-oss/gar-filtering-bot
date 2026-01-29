require("dotenv").config();
const fs = require("fs");

const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder 
} = require("discord.js");

const noblox = require("noblox.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

console.log("Starting GAR Sentinel Bot...");

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

/* ============================
   SLASH COMMAND HANDLER
============================ */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  /* ============================
     /ping
  ============================ */
  if (command === "ping") {
    return interaction.reply("🏓 Pong! Bot is working perfectly.");
  }

  /* ============================
     /role
     Usage: /role user: @user package: rose
  ============================ */
  if (command === "role") {
    const member = interaction.options.getMember("user");
    const packageKey = interaction.options.getString("package");

    let roleConfig = JSON.parse(fs.readFileSync("./roles.json"));

    if (!roleConfig[packageKey]) {
      return interaction.reply({
        content: `❌ Package not found.\nAvailable: ${Object.keys(roleConfig).join(", ")}`,
        ephemeral: true
      });
    }

    let addedRoles = [];

    for (const roleName of roleConfig[packageKey]) {
      const role = interaction.guild.roles.cache.find(
        (r) => r.name === roleName
      );

      if (role) {
        await member.roles.add(role);
        addedRoles.push(roleName);
      }
    }

    return interaction.reply({
      content: `✅ Successfully added package **${packageKey}** to ${member.user.tag}\nRoles Added: ${addedRoles.join(", ")}`
    });
  }

  /* ============================
     /check
     Usage: /check username: RobloxUser
  ============================ */
  if (command === "check") {
    const username = interaction.options.getString("username");

    await interaction.reply("🔍 Checking Roblox account...");

    try {
      const userId = await noblox.getIdFromUsername(username);
      const info = await noblox.getPlayerInfo(userId);

      const embed = new EmbedBuilder()
        .setTitle(`${username}'s Information`)
        .setDescription(`🆔 Player ID: **${userId}**`)
        .setThumbnail(
          `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`
        )
        .addFields(
          { name: "Display Name", value: info.displayName || "None", inline: true },
          { name: "Status", value: info.status || "None", inline: true },
          { name: "Blurb", value: info.blurb || "None" }
        )
        .setFooter({ text: "Sentinel Alliance Security System" })
        .setTimestamp();

      return interaction.editReply({
        content: "✅ Roblox Check Complete!",
        embeds: [embed]
      });

    } catch (err) {
      return interaction.editReply("❌ Roblox username not found.");
    }
  }
});

/* ============================
   LOGIN
============================ */

client.login(process.env.TOKEN);
