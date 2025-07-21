import React, { useEffect, useState } from 'react';

function CustomerList({ reload }) {
  const [customers, setCustomers] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    fetch('http://localhost:5000/api/customers')
      .then(res => res.json())
      .then(data => {
        setCustomers(data);
      })
      .catch(err => console.error('❌ Error:', err));
  }, [reload]);

  const handleDelete = async (id) => {
    if (!window.confirm('ยืนยันการลบลูกค้า?')) return;

    await fetch(`http://localhost:5000/api/customers/${id}`, {
      method: 'DELETE',
    });

    setCustomers(customers.filter(c => c._id !== id));
  };

  const handleEditClick = (customer) => {
    setEditId(customer._id);
    setEditForm({ name: customer.name, email: customer.email, phone: customer.phone });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSave = async (id) => {
    const res = await fetch(`http://localhost:5000/api/customers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(editForm),
    });

    const updated = await res.json();
    setCustomers(customers.map(c => (c._id === id ? updated : c)));
    setEditId(null); // ปิดโหมดแก้ไข
  };

  return (
    <div>
      <h2>📄 รายชื่อลูกค้า</h2>
      <ul>
        {customers.map((c) => (
          <li key={c._id}>
            {editId === c._id ? (
              <>
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  required
                />
                <input
                  type="email"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  required
                />
                <input
                  type="text"
                  name="phone"
                  value={editForm.phone}
                  onChange={handleEditChange}
                  required
                />
                <button onClick={() => handleEditSave(c._id)}>💾 บันทึก</button>
                <button onClick={() => setEditId(null)}>❌ ยกเลิก</button>
              </>
            ) : (
              <>
                {c.name} - {c.email} - {c.phone}{' '}
                <button onClick={() => handleEditClick(c)}>✏️ แก้ไข</button>{' '}
                <button onClick={() => handleDelete(c._id)} style={{ color: 'red' }}>
                  🗑️ ลบ
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CustomerList;
