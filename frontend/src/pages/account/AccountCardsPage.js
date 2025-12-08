import React from 'react';

export default function AccountCardsPage() {
  return (
    <div className="all-transaction-page">
      <div className="transaction-container">
        <div className="page-header">
          <div className="header-content">
            <div className="header-title-group">
              <div className="page-header-icon">
                💳
              </div>
              <div>
                <h1>บัตร</h1>
                <p className="subtitle">จัดการบัตรสำหรับบัญชี</p>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '16px' }}>
          <p>ยังไม่มีข้อมูลบัตร</p>
        </div>
      </div>
    </div>
  );
}
