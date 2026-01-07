import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Person, Envelope, Lock, Eye, EyeSlash, PersonVcard } from 'react-bootstrap-icons';
import './RegisterPage.css';

function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        window.alert('✅ สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
        navigate('/login');
      } else {
        setErrorMsg(data.error || 'เกิดข้อผิดพลาดที่ไม่รู้จัก');
      }
    } catch (err) {
      setErrorMsg('❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ' + err.message);
    }
  };

  return (
    <div className="register-page-container fade-up">
      <div className="register-card">
        <div className="register-header">
          <h2>สร้างบัญชีใหม่</h2>
          <p>เริ่มต้นใช้งานโดยการกรอกข้อมูลของคุณ</p>
        </div>

        {errorMsg && (
          <div className="register-error-message">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="register-form">
          <div className="input-group">
            <Person className="input-icon" />
            <input
              type="text"
              name="username"
              className="form-control"
              placeholder="ชื่อผู้ใช้"
              value={form.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <PersonVcard className="input-icon" />
            <input
              type="text"
              name="name"
              className="form-control"
              placeholder="ชื่อ-นามสกุล"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <Envelope className="input-icon" />
            <input
              type="email"
              name="email"
              className="form-control"
              placeholder="อีเมล"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <Lock className="input-icon" />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              className="form-control"
              placeholder="รหัสผ่าน"
              value={form.password}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            >
              {showPassword ? <EyeSlash /> : <Eye />}
            </button>
          </div>

          <button type="submit" className="register-btn">สมัครสมาชิก</button>
        </form>

        <p className="login-link">
          มีบัญชีอยู่แล้ว? <Link to="/login">เข้าสู่ระบบที่นี่</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;