import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const [customerCount, setCustomerCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'admin') {
          navigate('/dashboard/admin');
          return;
        }
      } catch (e) {}
    }
    const fetchCustomerCount = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/customers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCustomerCount(res.data.length);
      } catch (err) {
        setCustomerCount(null);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomerCount();
  }, [navigate]);

  return (
    <div className="container mt-4">
      <h2>Dashboard</h2>
      <hr />
      <div className="row mb-4">
        <div className="col-md-4">
          <div
            className="card text-center shadow-sm"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/dashboard/list')}
            title="ดูรายชื่อลูกค้า"
          >
            <div className="card-body">
              <h5 className="card-title">จำนวนลูกค้าทั้งหมด</h5>
              <p className="display-4 mb-0">
                {loading ? '...' : customerCount !== null ? customerCount : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
