// นำเข้า React และ Hook ที่จำเป็น
import React, { useState } from 'react';
// นำเข้า useNavigate สำหรับเปลี่ยนหน้า
import { useNavigate, Link } from 'react-router-dom';

// สร้างคอมโพเนนต์ LoginPage
function LoginPage({ onLoginSuccess }) {
  // สร้าง state สำหรับเก็บข้อมูลฟอร์มและ error
  const [form, setForm] = useState({ username: '', password: '' });
  const [errorMsg, setErrorMsg] = useState('');
  // เพิ่ม state สำหรับควบคุมการแสดงรหัสผ่าน
  const [showPassword, setShowPassword] = useState(false);
  // สร้างตัวแปร navigate สำหรับเปลี่ยนหน้า
  const navigate = useNavigate();

  // ฟังก์ชันสำหรับจัดการเมื่อกรอกข้อมูลในฟอร์ม
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ฟังก์ชันสำหรับจัดการเมื่อกดปุ่มล็อกอิน
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      // เรียก API สำหรับล็อกอิน
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        // decode token เพื่อดู role
        localStorage.setItem('token', data.token);
        let role = 'user';
        try {
          const payload = JSON.parse(atob(data.token.split('.')[1]));
          role = payload.role || 'user';
        } catch (e) {}
        window.alert('✅ เข้าสู่ระบบสำเร็จ');
        if (role === 'admin') {
          navigate('/dashboard/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        setErrorMsg('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
      }
    } catch (err) {
      setErrorMsg('❌ มีข้อผิดพลาด: ' + err.message);
    }
  };

  // ส่วนแสดงผลหน้าจอ Login
  return (
    <div className="container mt-5" style={{ maxWidth: '400px' }}>
      {/* ส่วนหัว Login */}
      <h2 className="mb-3 text-primary">🔐 เข้าสู่ระบบ</h2>
      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          {errorMsg}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {/* ฟิลด์กรอกชื่อผู้ใช้ */}
        <div className="mb-3">
          <input
            type="text"
            name="username"
            className="form-control"
            placeholder="Username"
            value={form.username}
            onChange={handleChange}
            required
          />
        </div>
        {/* ฟิลด์กรอกรหัสผ่าน */}
        <div className="mb-3">
          <div className="input-group">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              className="form-control"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "ซ่อน" : "แสดง"}
            </button>
          </div>
        </div>
        {/* ปุ่มล็อกอิน */}
        <button type="submit" className="btn btn-primary w-100">Login</button>
      </form>
      {/* ลิงก์ไปยังหน้าสมัครสมาชิก */}
      <p className="mt-3 text-center">
        ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิก</Link>
      </p>
    </div>
  );
}

export default LoginPage;