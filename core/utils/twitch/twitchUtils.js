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
          
        this.client.twitchAccessToken = await fetch(data.url, data.params)
            .then(res => { res.access_token })
            .catch( (err) =>  { console.log(err) });
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
            const response = await fetch(data.url, data.params)
                .then(response => response.json())
                .catch( (err) => { console.log(err) });
            if(response.expires_in < 259200) {
                await this.createToken();
            }
        }
    }

    async findChannelID(channelName) {
        const channelId = await fetch("https://api.twitch.tv/helix/users", { login : channelName })
            .then(res => res.id )
            .catch( (err) => { console.log(err) });
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

        const response = await fetch(data.url, data.params)
            .then(res => res.json())
            .catch( (err) => { console.log(err) });
    }
}
module.exports = TwitchUtils;