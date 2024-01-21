const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
const config = require('./config.js');

process.on('unhandledRejection', err => {
    console.log(err)
});

const COMMANDS = {
    TEXT: 'Simple text message',
    IMAGE: 'Send image',
    DOCUMENT: 'Send document',
    VIDEO: 'Send video',
    CONTACT: 'Send contact',
    PRODUCT: 'Send product',
    GROUP_CREATE: 'Create group',
    GROUP_TEXT: 'Simple text message for the group',
    GROUPS_IDS: 'Get the id\'s of your three groups'
}

const FILES = {
    IMAGE: './files/file_example_JPG_100kB.jpg',
    DOCUMENT: './files/file-example_PDF_500_kB.pdf',
    VIDEO: './files/file_example_MP4_480_1_5MG.mp4',
    VCARD: './files/sample-vcard.txt'
}

/**
 * Send request to Whapi.Cloud
 * @param endpoint - endpoint path
 * @param params - request body
 * @param method - GET, POST, PATCH, DELETE
 * @returns {Promise<object>}
 */
async function sendWhapiRequest(endpoint, params = {}, method = 'POST') {
    let options = {
        method: method,
        headers: {
            Authorization: `Bearer ${config.token}`
        },
    };
    if (!params.media) options.headers['Content-Type'] = 'application/json';
    let url = `${config.apiUrl}/${endpoint}`;
    if (params && Object.keys(params).length > 0) {
        if (method === 'GET')
            url += '?' + new URLSearchParams(params);
        else
            options.body = params?.media ? toFormData(params) : JSON.stringify(params);
    }
    const response = await fetch(url, options);
    let json = await response.json();
    console.log('Whapi response:', JSON.stringify(json, null, 2));
    return json;
}

/**
 * Convert object to FormData
 * @param obj
 * @returns {FormData}
 */
function toFormData(obj) {
    const form = new FormData();
    for (let key in obj) {
        form.append(key, obj[key]);
    }
    return form;
}

async function setHook() {
    if (config.botUrl) {
        /** type {import('./whapi').Settings} */
        const settings = {
            webhooks: [
                {
                    url: config.botUrl,
                    events: [
                        // default event for getting messages
                        { type: "message", method: "post" }
                    ],
                    mode: "method"
                }
            ]
        }
        await sendWhapiRequest('settings', settings, 'PATCH');
    }
}

async function handleNewMessages(req, res) {
    try {
        /** type {import('./whapi').Message[]} */
        const messages = req?.body?.messages;
        if (req?.body?.token != config.token) {
            res.send("Token is not Correct..");
            return
        }

        for (let message of messages) {
            if (message.from_me) continue;
            /** type {import('./whapi').Sender} */
            const sender = {
                to: message.chat_id
            }
            let endpoint = 'messages/text';
            const command = Object.keys(COMMANDS)[+message.text?.body?.trim() - 1];

            switch (command) {
                case 'TEXT': {
                    sender.body = message.text?.text;
                    break;
                }
                case 'IMAGE': {
                    sender.caption = 'Medidate Bot Text under the photo.';
                    sender.media = fs.createReadStream(FILES.IMAGE);
                    endpoint = 'messages/image';
                    break;
                }
                case 'DOCUMENT': {
                    sender.caption = 'Medidate Bot Text under the document.';
                    sender.media = fs.createReadStream(FILES.DOCUMENT);
                    endpoint = 'messages/document';
                    break;
                }
                case 'VIDEO': {
                    sender.caption = 'Medidate Bot Text under the video.';
                    sender.media = fs.createReadStream(FILES.VIDEO);
                    endpoint = 'messages/video';
                    break;
                }
                case 'CONTACT': {
                    sender.name = 'Medidate Bot Test';
                    sender.vcard = fs.readFileSync(FILES.VCARD).toString();
                    endpoint = 'messages/contact';
                    break;
                }
                case 'PRODUCT': {
                    /* you can get real product id using endpoint  https://whapi.readme.io/reference/getproducts */
                    endpoint = `business/products/${config.product}`;
                    break;
                }
                case 'GROUP_CREATE': {
                    /* Warning : you can create group only with contacts from phone contact list */
                    const res = await sendWhapiRequest(`groups`, { subject: 'Whapi.Cloud Test', participants: [message.chat_id.split('@')[0]] });
                    sender.body = res.group_id ? `Group created. Group id: ${res.group_id}` : 'Error';
                    break;
                }
                case 'GROUP_TEXT': {
                    /*To get group id, use /groups endpoint */
                    sender.to = config.group;
                    sender.body = 'Simple text message for the group';
                    break;
                }
                case 'GROUPS_IDS': {
                    const { groups } = await sendWhapiRequest('groups', { count: 3 }, 'GET');
                    sender.body = groups && groups.reduce((prevVal, currVal, i) => {
                        return i === 0 ? `${currVal.id} - ${currVal.name}` : prevVal + ',\n ' + `${currVal.id} - ${currVal.name}`;
                    }, '') || 'No groups';
                    break;
                }
                default: {
                    sender.body = 'Hi. Send me a number from the list. Don\'t forget to change the actual data in the code!  \n\n' +
                        Object.values(COMMANDS).map((text, i) => `${i + 1}. ${text}`).join('\n');
                }
            }
            await sendWhapiRequest(endpoint, sender);
        }
        res.send('Ok');
    } catch (e) {
        res.send(e.message);
    }
}

// Create a new instance of express
const app = express();
app.use(bodyParser.json());

app.get('/', function (req, res) {
    //Keep server alive hack
    setInterval(function () {
        console.log('keep server alive');
    }, 3500000); //60 * 60 * 1000)//less then an hour

    res.send('Bot is running');
});

app.post('/messages', handleNewMessages);

setHook().then(() => {
    const port = config.port || (config.botUrl.indexOf('https:') === 0 ? 443 : 80)
    app.listen(port, function () {
        console.log(`Listening on port ${port}...`);
    });
});

