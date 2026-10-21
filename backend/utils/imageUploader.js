const cloudinary = require('cloudinary').v2;

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} imageBuffer - Image buffer from LINE
 * @param {string} fileName - Original filename or description
 * @param {string} folder - Cloudinary folder path (default: 'line-receipts')
 * @returns {Promise<{url: string, public_id: string, success: boolean}>}
 */
async function uploadToCloudinary(imageBuffer, fileName = 'receipt', folder = 'line-receipts') {
  try {
    if (!imageBuffer) {
      console.warn('[imageUploader] No image buffer provided');
      return { url: null, public_id: null, success: false, error: 'No image buffer' };
    }

    // Configure Cloudinary (uses env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      console.warn('[imageUploader] Cloudinary credentials not configured');
      return { url: null, public_id: null, success: false, error: 'Cloudinary not configured' };
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    console.log(`[imageUploader] Uploading image to Cloudinary (folder: ${folder})...`);

    // Upload using Cloudinary's upload stream API
    return new Promise((resolve) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const publicId = `${folder}/${fileName}-${timestamp}`;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'image',
          overwrite: false, // Don't overwrite if exists
          folder: folder,
          timeout: 60000, // 60 second timeout
        },
        (error, result) => {
          if (error) {
            console.error('[imageUploader] Cloudinary upload error:', error.message);
            resolve({
              url: null,
              public_id: null,
              success: false,
              error: error.message
            });
          } else {
            const imageUrl = result.secure_url || result.url;
            console.log(`[imageUploader] ✅ Image uploaded successfully`);
            console.log(`[imageUploader]   URL: ${imageUrl}`);
            console.log(`[imageUploader]   Public ID: ${result.public_id}`);
            
            resolve({
              url: imageUrl,
              public_id: result.public_id,
              success: true,
              cloudinaryResult: result
            });
          }
        }
      );

      // Pipe the buffer into the upload stream
      uploadStream.end(imageBuffer);
    });

  } catch (error) {
    console.error('[imageUploader] Unexpected error:', error.message);
    return {
      url: null,
      public_id: null,
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete image from Cloudinary (if needed later)
 * @param {string} public_id - Cloudinary public_id
 * @returns {Promise<boolean>}
 */
async function deleteFromCloudinary(public_id) {
  try {
    if (!public_id) return false;

    console.log(`[imageUploader] Deleting image from Cloudinary: ${public_id}`);
    
    const result = await cloudinary.uploader.destroy(public_id);
    
    if (result.result === 'ok') {
      console.log(`[imageUploader] ✅ Image deleted successfully`);
      return true;
    } else {
      console.warn(`[imageUploader] Delete result:`, result.result);
      return false;
    }
  } catch (error) {
    console.error('[imageUploader] Error deleting image:', error.message);
    return false;
  }
}

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
};
