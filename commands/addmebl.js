const Command = require("../core/command/command.js");

class AddmeBL extends Command {
    async run(client, message, args) {
        if (!args.length) {
            return message.channel.send(`Please use a Beat Leader id... ${message.author}!`);
        } else if (args) {
            let id = args[0].replace(/\D/g, '');
            let user = await client.beatleader.getUser(id);

            if (!user) {
                await message.channel.send("Something went terribly wrong, check your Beat Leader id and try again.")
                return;
            }

            if (user.errorMessage) {
                await message.channel.send(`Could not add you because of an error: \n${user.errorMessage}\nMake sure this link takes you to your profile <https://www.beatleader.xyz/u/${id}>`);
                return;
            }

            let myobj = { discId: message.author.id, scId: id, discName: message.author.username, country: user.country };
            let query = { discId: message.author.id };

            client.db.collection("discordRankBotUsers").find(query).toArray(async function (err, dbres) {
                if (err) throw err;
                if (dbres?.length < 1) {
                    client.db.collection("discordRankBotUsers").insertOne(myobj, async function (err) {
                        if (err) throw err;
                        console.log(`inserted ${message.author.username} with sc ${user.name}`);

                        if (user.country === client.config.country) {
                            if (message.member.roles.cache.some(role => role.name === 'landed')) {
                                let addRole = message.guild.roles.cache.find(role => role.name === "Verified");
                                await message.member.roles.set([addRole])
                                    .catch(console.log);
                                userRegistered(client, message, client.config.adminchannelID, user, id);
                            }
                            else if (message.member.roles.cache.some(role => role.name === 'Guest')) {
                                const addRole = message.guild.roles.cache.find(role => role.name === "Verified");
                                const deleteRole = message.guild.roles.cache.find(role => role.name === "Guest")
                                await message.member.roles.add([addRole])
                                    .catch(console.log())
                                await message.member.roles.remove([deleteRole])
                                    .catch(console.log())
                                message.channel.send(`You have been added and your role will be set with the next update, or if you are impatient you can run ${client.config.prefix}roleme.`);
                            }
                            else {
                                await message.channel.send(`Added you as ${user.name}\n<https://www.beatleader.xyz/u/${user.id}>`);
                            }
                        } else {
                            if (message.member.roles.cache.some(role => role.name === 'landed')) {
                                let addRole = message.guild.roles.cache.find(role => role.name === "Guest");
                                await message.member.roles.set([addRole])
                                    .catch(console.log);
                                userRegistered(client, message, client.config.adminchannelID, user, id);
                            } else message.channel.send("You have been added but unfortunately you will not get a role based on your rank as its not supported for international players.");
                        }
                    });
                } else {
                    await message.channel.send("You propably already exist in the database...");
                }
            })
        }
    }
}

async function userRegistered(client, message, adminchannelID, user, id) {
    try {
        await message.author.send("You have successfully registered to the Finnish Beat Saber community discord. \nRemember to check the rules in the #info-etc channel and for further bot interaction go to #botstuff and enjoy your stay.")
    } catch (err) {
        console.log("Could not dm user" + err)
    }
    await client.channels.cache.get(adminchannelID).send(`${message.author.username} registered. Country: ${user.country} \n<https://www.beatleader.xyz/u/${id}>`)
}

module.exports = AddmeBL;