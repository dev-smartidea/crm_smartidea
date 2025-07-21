import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      console.log('Register submit:', form);
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });
      console.log('Register response:', res);
      let data = {};
      let isJson = false;
      let contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await res.json();
          isJson = true;
        } catch (jsonErr) {
          setErrorMsg('❌ ข้อมูลจากเซิร์ฟเวอร์ผิดรูปแบบ');
          return;
        }
      } else {
        // ถ้า response ไม่ใช่ JSON
        setErrorMsg('❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ หรือเซิร์ฟเวอร์ไม่ตอบกลับข้อมูลที่ถูกต้อง');
        return;
      }
      console.log('Register response data:', data);
      if (res.ok && isJson) {
        window.alert('✅ สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ');
        navigate('/login');
      } else {
        setErrorMsg(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (err) {
      // network error เช่น fetch ไม่สำเร็จ
      setErrorMsg('❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์: ' + err.message);
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: '400px' }}>
      <h2 className="mb-3 text-success">📝 สมัครสมาชิก</h2>
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
            type="text"
            name="name"
            className="form-control"
            placeholder="ชื่อ-นามสกุล"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <input
            type="email"
            name="email"
            className="form-control"
            placeholder="Email"
            value={form.email}
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
        <button type="submit" className="btn btn-success w-100">สมัคร</button>
      </form>
      <p className="mt-3 text-center">
        มีบัญชีแล้ว? <a href="/login">เข้าสู่ระบบ</a>
      </p>
    </div>
  );
}

export default RegisterPage;