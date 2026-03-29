const fs = require('fs');
const path = require('path');

async function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const mod = require(path.join(eventsPath, file));

    // Support both single { name, execute } and array [{ name, execute }, ...]
    const events = Array.isArray(mod) ? mod : [mod];

    for (const event of events) {
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
      console.log(`✅ Loaded event: ${event.name}`);
    }
  }
}

module.exports = { loadEvents };
