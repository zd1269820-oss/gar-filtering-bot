const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quote")
    .setDescription("Get a random Sentinel quote"),

  async execute(interaction) {
    let quotes = JSON.parse(fs.readFileSync("./quotes.json"));

    if (!quotes.length) {
      return interaction.reply("No quotes saved yet.");
    }

    const random = quotes[Math.floor(Math.random() * quotes.length)];

    interaction.reply(`📌 **Sentinel Quote:**\n"${random}"`);
  },
};
