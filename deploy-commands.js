require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const folders = fs.readdirSync(commandsPath);

for (const folder of folders) {
  const folderPath = path.join(commandsPath, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const mod = require(path.join(folderPath, file));

    // Single command
    if (mod.data && mod.execute) {
      commands.push(mod.data.toJSON());
      console.log(`📝 Queued: ${mod.data.name}`);
      continue;
    }

    // Multi command
    for (const [, command] of Object.entries(mod)) {
      if (command?.data && command?.execute) {
        commands.push(command.data.toJSON());
        console.log(`📝 Queued: ${command.data.name}`);
      }
    }
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`\n🚀 Mendaftarkan ${commands.length} slash commands...\n`);

    let data;
    if (process.env.GUILD_ID) {
      // Guild commands (instant, untuk development)
      data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Berhasil deploy ${data.length} guild commands ke server!`);
    } else {
      // Global commands (butuh ~1 jam untuk aktif)
      data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log(`✅ Berhasil deploy ${data.length} global commands!`);
    }
  } catch (err) {
    console.error('❌ Gagal deploy commands:', err);
  }
})();
