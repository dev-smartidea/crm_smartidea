import { useState, useEffect } from 'react';

/**
 * Custom hook สำหรับ debounce value
 * @param {any} value - ค่าที่ต้องการ debounce
 * @param {number} delay - เวลา delay ในหน่วย milliseconds (default: 500ms)
 * @returns {any} - ค่าที่ผ่าน debounce แล้ว
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 * 
 * useEffect(() => {
 *   // เรียก API ด้วย debouncedSearchTerm
 *   fetchData(debouncedSearchTerm);
 * }, [debouncedSearchTerm]);
 */
function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // ตั้ง timer เพื่ออัปเดต debounced value หลังจากผ่าน delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clear timeout ถ้า value เปลี่ยนก่อนครบ delay
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
