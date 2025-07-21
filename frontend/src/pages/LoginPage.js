import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function LoginPage({ onLoginSuccess }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const [errorMsg, setErrorMsg] = useState('');

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

  return (
    <div className="container mt-5" style={{ maxWidth: '400px' }}>
      <h2 className="mb-3 text-primary">🔐 เข้าสู่ระบบ</h2>
      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          {errorMsg}
        </div>
      )}
      <form onSubmit={handleSubmit}>
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
        <div className="mb-3">
          <input
            type="password"
            name="password"
            className="form-control"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary w-100">Login</button>
      </form>
      <p className="mt-3 text-center">
        ยังไม่มีบัญชี? <a href="/register">สมัครสมาชิก</a>
      </p>
    </div>
  );
}

export default LoginPage;