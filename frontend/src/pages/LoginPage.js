import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Person, Lock, Eye, EyeSlash } from 'react-bootstrap-icons';
import './LoginPage.css';

function LoginPage({ onLoginSuccess }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem('token', data.token);
        let role = 'user';
        try {
          const payload = JSON.parse(atob(data.token.split('.')[1]));
          role = payload.role || 'user';
        } catch (e) {
          console.error("Token parsing error:", e);
        }
        
        // Trigger onLoginSuccess callback if provided
        if (onLoginSuccess) {
          onLoginSuccess();
        }
        
        // Navigate without alert to prevent blocking
        if (role === 'admin') {
          navigate('/dashboard/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        setErrorMsg(data.error || 'เกิดข้อผิดพลาดที่ไม่รู้จัก');
      }
    } catch (err) {
      setErrorMsg('❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ' + err.message);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        <div className="login-header">
          <h2>เข้าสู่ระบบ</h2>
          <p>กรุณาลงชื่อเข้าใช้บัญชีของคุณ</p>
        </div>

        {errorMsg && (
          <div className="login-error-message">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
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

          <button type="submit" className="login-btn">เข้าสู่ระบบ</button>
        </form>

        <p className="register-link">
          ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิกที่นี่</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;