import React, { useState } from 'react';

function CustomerForm({ onCustomerAdded }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch('http://localhost:5000/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (res.ok) {
        alert('✅ เพิ่มลูกค้าสำเร็จ');
        onCustomerAdded(); // แจ้ง parent ให้โหลดข้อมูลใหม่
        setForm({ name: '', email: '', phone: '' }); // reset
      } else {
        alert('❌ เพิ่มลูกค้าไม่สำเร็จ: ' + data.error);
      }
    } catch (err) {
      alert('❌ เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
      <h2>➕ เพิ่มลูกค้าใหม่</h2>
      <input
        type="text"
        name="name"
        placeholder="ชื่อ"
        value={form.name}
        onChange={handleChange}
        required
      /><br /><br />
      <input
        type="email"
        name="email"
        placeholder="อีเมล"
        value={form.email}
        onChange={handleChange}
        required
      /><br /><br />
      <input
        type="text"
        name="phone"
        placeholder="เบอร์โทรศัพท์"
        value={form.phone}
        onChange={handleChange}
        required
      />
      <br /><br />
            <input
        type="text"
        name="company"
        placeholder="บริษัท"
        value={form.company}
        onChange={handleChange}
        required
      />
      <br /><br />
      <button type="submit">✅ บันทึก</button>
    </form>
  );
}

export default CustomerForm;
