module.exports = {
    port: process.env.PORT,
    // API endpoint URL
    apiUrl: "https://gate.whapi.cloud",
    // API token from your channel
    token: process.env.TOKEN,
// The ID of the group to which we will send the message. Use to find out the ID: https://whapi.readme.io/reference/getgroups
    group: process.env.GROUP,
// The ID of the product we will send for the example. Create a product in your WhatsApp and find out the product ID: https://whapi.readme.io/reference/getproducts
    product: process.env.PRODUCT,
    // Bot`s URL (for static file). Webhook Link to your server. At ( {server link}/messages ), when POST is requested, processing occurs
    botUrl: process.env.baseURL + "/messages"
}
