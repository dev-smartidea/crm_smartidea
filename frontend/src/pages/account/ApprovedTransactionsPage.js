import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { CheckCircleFill, Google, Facebook, Search, CashCoin, Wallet } from 'react-bootstrap-icons';
import './ApprovedTransactionsPage.css';
import '../shared/DashboardPage.css';
import '../shared/ImageGalleryPage.css';

export default function ApprovedTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const pageSize = 6;
  const [currentPage, setCurrentPage] = useState(1);
  
  // ค้นหา
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [serviceFilter, setServiceFilter] = useState('');
  
  const token = localStorage.getItem('token');
  const api = process.env.REACT_APP_API_URL;

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
      const [txRes, custRes] = await Promise.all([
        axios.get(`${api}/api/transactions?submissionStatus=approved&limit=500`, authHeaders),
        axios.get(`${api}/api/customers`, authHeaders)
      ]);
      
      const formatted = (txRes.data.transactions || []).map(tx => ({
        ...tx,
        customerName: tx.serviceId?.customerId?.name || '-',
        serviceName: tx.serviceId?.name || '-'
      }));
      
      setTransactions(formatted);
      setFilteredTransactions(formatted);
      setCustomers(custRes.data || []);
    } catch (e) {
      console.error('Load data failed:', e);
    } finally {
      setLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ฟังก์ชันค้นหา
  const handleSearch = useCallback(() => {
    let result = [...transactions];
    
    // กรองตามลูกค้า
    if (selectedCustomerId) {
      result = result.filter(tx => tx.serviceId?.customerId?._id === selectedCustomerId);
    }
    
    // กรองตามบริการ
    if (serviceFilter) {
      result = result.filter(tx => 
        tx.serviceName && tx.serviceName.toLowerCase().includes(serviceFilter.toLowerCase())
      );
    }
    
    setFilteredTransactions(result);
    setCurrentPage(1);
  }, [transactions, selectedCustomerId, serviceFilter]);

  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pageItems = filteredTransactions.slice(startIndex, endIndex);

  // Filter customers และ services
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerQuery.toLowerCase())
  );

  const uniqueServices = [...new Set(transactions.map(tx => tx.serviceName).filter(Boolean))];
  const filteredServices = uniqueServices.filter(s =>
    s.toLowerCase().includes(serviceQuery.toLowerCase())
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(amount);
  };

  const formatNumber = (amount) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) return <div style={{ padding: '2rem' }}>กำลังโหลด...</div>;

  return (
    <div className="all-transaction-page">
      <div className="transaction-container">
        {/* Header - reuse gallery header styles */}
        <div className="gallery-header">
          <div className="gallery-header-title">
            <CheckCircleFill className="gallery-icon" />
            <div>
              <h2>รายการที่อนุมัติแล้ว</h2>
              <p className="gallery-subtitle">รายการเติมเงินที่ผ่านการอนุมัติทั้งหมด</p>
            </div>
          </div>
          {filteredTransactions.length > 0 && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="summary-card" style={{ minWidth: '160px', padding: '10px 14px' }}>
                <CashCoin size={20} />
                <div>
                  <div className="summary-label" style={{ fontSize: '0.75rem' }}>ยอดรวมทั้งหมด</div>
                  <div className="summary-value" style={{ fontSize: '0.95rem' }}>
                    {formatCurrency(filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0))}
                  </div>
                </div>
              </div>
              <div className="summary-card" style={{ minWidth: '140px', padding: '10px 14px' }}>
                <Wallet size={20} />
                <div>
                  <div className="summary-label" style={{ fontSize: '0.75rem' }}>จำนวนรายการ</div>
                  <div className="summary-value" style={{ fontSize: '0.95rem' }}>{filteredTransactions.length} รายการ</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search Section */}
        <div className="search-section">
          <div className="search-filters">
            {/* ค้นหาตามลูกค้า */}
            <div className="filter-group">
              <label className="filter-label">
                <Search size={16} />
                ค้นหาตามลูกค้า
              </label>
              <div className="combobox-wrapper">
                <input
                  type="text"
                  className="combobox-input"
                  placeholder="พิมพ์ชื่อลูกค้า..."
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                />
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="combobox-dropdown">
                    <div
                      className="combobox-option"
                      onClick={() => {
                        setSelectedCustomerId('');
                        setCustomerQuery('');
                      }}
                    >
                      ทั้งหมด
                    </div>
                    {filteredCustomers.map(c => (
                      <div
                        key={c._id}
                        className="combobox-option"
                        onClick={() => {
                          setSelectedCustomerId(c._id);
                          setCustomerQuery(c.name);
                        }}
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ค้นหาตามบริการ */}
            <div className="filter-group">
              <label className="filter-label">
                <Search size={16} />
                ค้นหาตามบริการ
              </label>
              <div className="combobox-wrapper">
                <input
                  type="text"
                  className="combobox-input"
                  placeholder="พิมพ์ชื่อบริการ..."
                  value={serviceQuery}
                  onChange={(e) => setServiceQuery(e.target.value)}
                  onFocus={() => setShowServiceDropdown(true)}
                  onBlur={() => setTimeout(() => setShowServiceDropdown(false), 200)}
                />
                {showServiceDropdown && filteredServices.length > 0 && (
                  <div className="combobox-dropdown">
                    <div
                      className="combobox-option"
                      onClick={() => {
                        setServiceFilter('');
                        setServiceQuery('');
                      }}
                    >
                      ทั้งหมด
                    </div>
                    {filteredServices.map(s => (
                      <div
                        key={s}
                        className="combobox-option"
                        onClick={() => {
                          setServiceFilter(s);
                          setServiceQuery(s);
                        }}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        {filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <CheckCircleFill size={64} color="#cbd5e1" />
            <p>ไม่พบรายการที่อนุมัติ</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>วันที่โอน</th>
                    <th>ลูกค้า</th>
                    <th>บริการ</th>
                    <th>จำนวนเงิน</th>
                    <th>ธนาคาร</th>
                    <th>หมายเหตุ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(tx => (
                    <tr key={tx._id}>
                      <td>{formatDate(tx.transactionDate)}</td>
                      <td>{tx.customerName}</td>
                      <td>
                        {tx.serviceId?.customerIdField && tx.serviceName ? (
                          <span className={`service-badge ${
                            tx.serviceName === 'Facebook Ads' ? 'facebook' :
                            tx.serviceName === 'Google Ads' ? 'google' :
                            'other'
                          }`}>
                            {tx.serviceName === 'Facebook Ads' && <Facebook className="service-icon" />}
                            {tx.serviceName === 'Google Ads' && <Google className="service-icon" />}
                            <span className="service-id-text">{tx.serviceId.customerIdField}</span>
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="amount-cell">{formatCurrency(tx.amount)}</td>
                      <td>
                        <span className={`badge-bank ${tx.bank ? tx.bank.toLowerCase() : 'other'}`}>
                          {tx.bank || '-'}
                        </span>
                      </td>
                      <td>
                        <div className="notes-cell">
                          {tx.notes && (
                            <div className="notes-text">{tx.notes}</div>
                          )}
                          {tx.breakdowns && tx.breakdowns.length > 0 && (
                            <div className="breakdown-list">
                              {tx.breakdowns.map((bd, idx) => (
                                <div key={idx} className="breakdown-item">
                                  <span className="breakdown-code">{bd.code}</span>
                                  <span>:</span>
                                  <span className="breakdown-amount">{formatNumber(bd.amount)}</span>
                                  <span>บาท</span>
                                  {bd.statusNote && <span className="breakdown-status">— {bd.statusNote}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {!tx.notes && (!tx.breakdowns || tx.breakdowns.length === 0) && '-'}
                        </div>
                      </td>
                      <td>
                        <span className="status-badge status-approved">
                          อนุมัติแล้ว
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ← ก่อนหน้า
                </button>
                <div className="pagination-info">
                  หน้า {currentPage} จาก {totalPages}
                </div>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  ถัดไป →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
