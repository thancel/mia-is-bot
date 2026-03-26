const fs = require('fs');
const path = require('path');

async function loadCommands(client) {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const folders = fs.readdirSync(commandsPath);

  for (const folder of folders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const mod = require(path.join(folderPath, file));

      // Single command export: { data, execute }
      if (mod.data && mod.execute) {
        client.commands.set(mod.data.name, mod);
        console.log(`✅ Loaded command: ${mod.data.name}`);
        continue;
      }

      // Multi command export: { ban: { data, execute }, kick: { data, execute }, ... }
      for (const [, command] of Object.entries(mod)) {
        if (command?.data && command?.execute) {
          client.commands.set(command.data.name, command);
          console.log(`✅ Loaded command: ${command.data.name}`);
        }
      }
    }
  }
}

module.exports = { loadCommands };
