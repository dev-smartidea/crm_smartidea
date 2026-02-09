/**
 * Helper function แปลง URL ของรูปภาพ
 * - ถ้าเป็น absolute URL (http/https) → ใช้ตรงๆ (Cloudinary)
 * - ถ้าเป็น relative path (/uploads/...) → ต่อ API URL หน้า
 */
export const getImageUrl = (url, apiBaseUrl) => {
  if (!url) return '';
  // ถ้าเป็น absolute URL (Cloudinary หรือ URL ภายนอก)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // ถ้าเป็น relative path (local uploads)
  return `${apiBaseUrl}${url}`;
};
