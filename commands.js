require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Test if the bot is working"),

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("Assign a role package to a user")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("User to role")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("package")
        .setDescription("Role package key (rose, iron, sentinel)")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("check")
    .setDescription("Check a Roblox account")
    .addStringOption(option =>
      option.setName("username")
        .setDescription("Roblox username")
        .setRequired(true)
    )

].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  console.log("Registering slash commands...");

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );

  console.log("✅ Slash commands registered!");
})();
