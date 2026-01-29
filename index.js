require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.commands = new Collection();

/* Load Commands */
const commandFiles = fs
  .readdirSync("./commands")
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

/* Auto Quotes */
const quotes = require("./quotes.json");

client.once("ready", () => {
  console.log(`✅ Sentinel Bot Online as ${client.user.tag}`);

  setInterval(() => {
    const guilds = client.guilds.cache;

    guilds.forEach((guild) => {
      const channel = guild.channels.cache.find(
        (c) => c.name === "sentinel-quotes"
      );

      if (!channel) return;

      const quote = quotes[Math.floor(Math.random() * quotes.length)];

      const embed = new EmbedBuilder()
        .setTitle("🛡 Sentinel Message")
        .setDescription(quote)
        .setFooter({ text: "Sentinel Alliance • Honor Above All" });

      channel.send({ embeds: [embed] });
    });
  }, 1000 * 60 * 60); // every 1 hour
});

/* Slash Handler */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(err);
    interaction.reply({
      content: "❌ Command failed.",
      ephemeral: true
    });
  }
});

client.login(process.env.TOKEN);
