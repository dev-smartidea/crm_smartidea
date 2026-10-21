const axios = require('axios');

/**
 * Download image from LINE Messaging API
 * @param {string} messageId - LINE message ID containing the image
 * @returns {Promise<Buffer>} - Image buffer
 */
async function downloadLineImage(messageId) {
  try {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    
    if (!channelAccessToken) {
      console.warn('[lineImageDownloader] LINE_CHANNEL_ACCESS_TOKEN not set');
      return null;
    }

    if (!messageId) {
      console.warn('[lineImageDownloader] No messageId provided');
      return null;
    }

    const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
    
    console.log(`[lineImageDownloader] Downloading image from messageId: ${messageId}`);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${channelAccessToken}`
      },
      responseType: 'arraybuffer', // Important: get raw binary data
      timeout: 30000 // 30 second timeout
    });

    if (!response.data) {
      console.warn('[lineImageDownloader] No data received from LINE');
      return null;
    }

    console.log(`[lineImageDownloader] ✅ Image downloaded successfully. Size: ${response.data.length} bytes`);
    return Buffer.from(response.data);

  } catch (error) {
    console.error('[lineImageDownloader] Error downloading image:', error.message);
    if (error.response?.status) {
      console.error(`[lineImageDownloader] HTTP Status: ${error.response.status}`);
    }
    return null;
  }
}

module.exports = {
  downloadLineImage,
};
