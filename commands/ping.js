const fs = require("fs");
const path = require("path");

client.commands = new Map();

const commandFiles = fs
  .readdirSync("./commands")
  .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);

  if (!command.data || !command.execute) {
    console.log(`❌ Skipping invalid command file: ${file}`);
    continue;
  }

  client.commands.set(command.data.name, command);
  console.log(`✅ Loaded command: ${command.data.name}`);
}
