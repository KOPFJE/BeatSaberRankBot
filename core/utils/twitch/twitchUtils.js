const fetch = require('node-fetch');

class TwitchUtils {
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }
    
    async createToken() {
        const data = {
            url : "https://id.twitch.tv/oauth2/token",
            params : {
                headers: { "Content-Type": "application/json" },
                body: { 
                    client_id: this.config.clientID,
                    client_secret: this.config.twitchSecret,
                    grant_type: "client_credentials"
                },
                method: 'POST'
            }

        }
          
        await fetch(data.url, data.params).then(response => { this.client.twitchAccessToken = response.access_token }).catch( (err) =>  { throw new Error(err) });
    }

    async checkToken() {
        if(!this.client.twitchAccessToken) {
            await this.createToken();
        } else {
            const data = {
                url : "https://id.twitch.tv/oauth2/validate",
                params : {
                    headers: { "Authorization" : "Bearer " + this.client.twitchAccessToken }
                }
            }
            await fetch(data.url, data.params).then(response => response.json()).catch( (err) => { throw new Error(err) });
            if(response.expires_in < 259200) {
                await this.createToken();
            }
        }
    }

    async findChannelID(channelName) {
        let channelId;
        await fetch("https://api.twitch.tv/helix/users", { login : channelName }).then(response => { channelId = response.id }).catch( (err) => { throw new Error(err) });
        return channelId;
    }

    async requestSubscriptions() {
        for(streamname in this.config.communityChannelName) {
            await this.requestSubscription(streamname);
        }
    }

    async requestSubscription(channelName, type) {
        const channelid = await this.findChannelID(channelName);
        const secret = channelName + Date.now();
        const data = {
            url : "https://api.twitch.tv/helix/eventsub/subscriptions",
            params : {
                method: 'POST',
                headers: {
                    "Authorization" : "Bearer " + this.client.twitchAccessToken,
                    "Content-Type" : "application/json",
                    "Client-ID" : this.config.clientID
                },
                body: {
                    "version" : 1,
                    "type" : type,
                    "condition": {
                        "broadcaster_user_id": channelid
                    },
                    "transport" : {
                        "method" : "webhook",
                        "callback" : this.config.callbackURL + "/notification",
                        "secret" : secret
                    }
                }
            }
        }

        await fetch(data.url, data.params).then(response => response.json()).catch( (err) => {throw new Error(err) });
    }
}
module.exports = TwitchUtils;