import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:5000/api/customers/${id}`)
      .then(res => res.json())
      .then(data => {
        setCustomer(data);
      })
      .catch(err => {
        console.error('❌ Error fetching customer details:', err);
        // Optionally, navigate to a 404 page or show an error message
      });
  }, [id]);

  if (!customer) {
    return <div>Loading customer details...</div>;
  }

  return (
    <div>
      <h2>👤 รายละเอียดลูกค้า</h2>
      <p><strong>ชื่อ:</strong> {customer.name}</p>
      <p><strong>อีเมล:</strong> {customer.email}</p>
      <p><strong>เบอร์โทรศัพท์:</strong> {customer.phone}</p>
      <button onClick={() => navigate(-1)}>⬅️ กลับ</button>
    </div>
  );
}

export default CustomerDetail;
