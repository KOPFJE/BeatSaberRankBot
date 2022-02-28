const Command = require("../core/command/command.js");

class Online extends Command {
    async run(client, message, args) {
        await message.channel.send(`${message.author} TODO. Makemonni on kuitenki offline :)`)
    }
}
module.exports = Online;