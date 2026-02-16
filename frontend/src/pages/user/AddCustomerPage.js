import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  PersonPlusFill, TelephoneFill, Globe, BriefcaseFill, 
  CheckCircleFill, ArrowCounterclockwise, Building, 
  CreditCard, EnvelopeFill, TagFill, ExclamationTriangleFill 
} from 'react-bootstrap-icons';
import './AddCustomerPage.css';
import '../shared/ImageGalleryPage.css'; 

export default function AddCustomerPage() {
  // 1. Initial States
  const customerTypeOptions = ['บุคคลธรรมดา', 'นิติบุคคล'];
  const businessSizeOptions = ['ธุรกิจขนาดเล็ก', 'ธุรกิจขนาดกลาง'];
  const initialFormState = {
    customerCode: '',
    name: '',
    customerType: '',
    address: '',
    phone: '',
    email: '',
    taxId: '',
    businessSize: '',
    productService: '',
    contactPerson: '' // ผู้ติดต่อ
  };

  const [formData, setFormData] = useState(initialFormState);
  const [allCustomers, setAllCustomers] = useState([]);
  const [nameQuery, setNameQuery] = useState('');
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [nameDuplicate, setNameDuplicate] = useState(false);
  
  const [taxIdQuery, setTaxIdQuery] = useState('');
  const [showTaxIdDropdown, setShowTaxIdDropdown] = useState(false);
  const [taxIdDuplicate, setTaxIdDuplicate] = useState(false);
  
  const [customerCodeDuplicate, setCustomerCodeDuplicate] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [touched, setTouched] = useState({});
  
  const [typeQuery, setTypeQuery] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [sizeQuery, setSizeQuery] = useState('');
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);

  const nameInputRef = useRef(null);
  const taxIdInputRef = useRef(null);

  // 2. Effects
  // ดึงข้อมูลลูกค้าทั้งหมดเพื่อใช้ตรวจสอบชื่อซ้ำและ Autocomplete
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/customers?search=`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAllCustomers(res.data || []);
      } catch (err) {
        console.error("Fetch error:", err);
        setAllCustomers([]);
      }
    };
    fetchCustomers();
  }, []);

  // ตรวจสอบชื่อซ้ำ Real-time
  useEffect(() => {
    const name = formData.name.trim().toLowerCase();
    setNameDuplicate(
      !!name && allCustomers.some(c => (c.name || '').trim().toLowerCase() === name)
    );
  }, [formData.name, allCustomers]);

  // ตรวจสอบ Tax ID ซ้ำ Real-time
  useEffect(() => {
    const taxId = formData.taxId.trim();
    setTaxIdDuplicate(
      !!taxId && allCustomers.some(c => (c.taxId || '').trim() === taxId)
    );
  }, [formData.taxId, allCustomers]);

  // ตรวจสอบรหัสลูกค้าซ้ำ Real-time
  useEffect(() => {
    const code = formData.customerCode.trim();
    setCustomerCodeDuplicate(
      !!code && allCustomers.some(c => (c.customerCode || '').trim() === code)
    );
  }, [formData.customerCode, allCustomers]);

  // 3. Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'name') {
      setNameQuery(value);
      setShowNameDropdown(true);
    }
    if (name === 'taxId') {
      setTaxIdQuery(value);
      setShowTaxIdDropdown(true);
    }
  };

  const handleSelectName = (nameValue) => {
    setFormData(prev => ({ ...prev, name: nameValue }));
    setNameQuery(nameValue);
    setShowNameDropdown(false);
    setTouched(prev => ({ ...prev, name: true }));
    if (nameInputRef.current) nameInputRef.current.blur();
  };

  const handleSelectTaxId = (taxIdValue) => {
    setFormData(prev => ({ ...prev, taxId: taxIdValue }));
    setTaxIdQuery(taxIdValue);
    setShowTaxIdDropdown(false);
    setTouched(prev => ({ ...prev, taxId: true }));
    if (taxIdInputRef.current) taxIdInputRef.current.blur();
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  const calculateProgress = () => {
    const requiredFields = ['customerCode', 'name', 'customerType', 'address', 'phone', 'email', 'taxId', 'businessSize', 'productService', 'contactPerson'];
    const filled = requiredFields.filter((field) => String(formData[field] || '').trim()).length;
    return Math.round((filled / requiredFields.length) * 100);
  };

  const handleReset = () => {
    setFormData(initialFormState);
    setSubmitSuccess(false);
    setSubmitError('');
    setTouched({});
    setTypeQuery('');
    setSizeQuery('');
    setNameQuery('');
    setShowNameDropdown(false);
    setShowTypeDropdown(false);
    setShowSizeDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (customerCodeDuplicate) {
      setSubmitError('มีรหัสลูกค้านี้ในระบบแล้ว กรุณาใช้รหัสอื่น');
      setTouched(prev => ({ ...prev, customerCode: true }));
      return;
    }
    if (nameDuplicate) {
      setSubmitError('มีชื่อลูกค้านี้ในระบบแล้ว กรุณาใช้ชื่ออื่น');
      setTouched(prev => ({ ...prev, name: true }));
      return;
    }
    if (taxIdDuplicate) {
      setSubmitError('มี Tax ID นี้ในระบบแล้ว กรุณาใช้เลขอื่น');
      setTouched(prev => ({ ...prev, taxId: true }));
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const token = localStorage.getItem('token');
      // ตรวจสอบค่าจาก Query State กรณีลืมเลือกจาก dropdown (ถ้ามี logic รองรับ custom text)
      const payload = { ...formData };
      
      await axios.post(`${process.env.REACT_APP_API_URL}/api/customers`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        handleReset();
        setIsSubmitting(false);
      }, 2000);
    } catch (error) {
      const status = error?.response?.status;
      const message = error?.response?.data?.error;
      setSubmitError(status === 409 ? `มีลูกค้าคนนี้ในระบบแล้ว - ${message || 'รหัสซ้ำ'}` : (message || 'เกิดข้อผิดพลาด'));
      setIsSubmitting(false);
    }
  };

  const progress = calculateProgress();

  return (
    <div className="add-customer-page">
      <div className="form-container">
        {/* Header Section */}
        <div className="form-header">
          <div className="header-content">
            <PersonPlusFill className="form-header-icon" />
            <div>
              <h2 className="form-header-title">เพิ่มข้อมูลลูกค้าใหม่</h2>
              <p className="form-header-subtitle">กรอกข้อมูลลูกค้าเพื่อเพิ่มเข้าสู่ระบบ</p>
            </div>
          </div>
          <div className="progress-container">
            <div className="progress-info">
              <span className="progress-label">ความสมบูรณ์ของข้อมูล</span>
              <span className="progress-percentage">{progress}%</span>
            </div>
            <div className="progress-bar-wrapper">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {submitSuccess && (
          <div className="success-message">
            <CheckCircleFill className="success-icon" />
            <div className="success-text">
              <h4>บันทึกข้อมูลสำเร็จ!</h4>
              <p>เพิ่มข้อมูลลูกค้าเข้าสู่ระบบเรียบร้อยแล้ว</p>
            </div>
          </div>
        )}

        {submitError && (
          <div className="error-message">
            <ExclamationTriangleFill className="error-icon" />
            <div className="error-text">
              <h4>เกิดข้อผิดพลาด!</h4>
              <p>{submitError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-card">
            <div className="card-header">
              <BriefcaseFill className="card-icon" />
              <h3 className="card-title">ข้อมูลลูกค้า (หลัก)</h3>
            </div>
            <div className="card-body">
              {/* Row 1: Code & Name */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="customerCode"><TagFill /> รหัสลูกค้า <span className="required">*</span></label>
                  <input
                    type="text"
                    id="customerCode"
                    name="customerCode"
                    className={`form-input ${touched.customerCode && (formData.customerCode ? 'valid' : 'invalid')}`}
                    value={formData.customerCode}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="เช่น CUST-0001"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="name"><PersonPlusFill /> ชื่อบริษัท <span className="required">*</span></label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="text"
                      id="name"
                      ref={nameInputRef}
                      name="name"
                      className={`form-input ${touched.name && (formData.name && !nameDuplicate ? 'valid' : 'invalid')}`}
                      value={formData.name}
                      onChange={handleChange}
                      onFocus={() => setShowNameDropdown(true)}
                      onBlur={(e) => {
                        handleBlur(e);
                        setTimeout(() => setShowNameDropdown(false), 200);
                      }}
                      placeholder="ชื่อบริษัท"
                      autoComplete="off"
                      required
                      style={{ width: '100%' }}
                    />
                    {showNameDropdown && nameQuery && (
                      <div className="combo-panel" style={{ zIndex: 10, maxHeight: 180, overflowY: 'auto', position: 'absolute', left: 0, right: 0 }}>
                        {allCustomers
                          .filter(c => c.name?.toLowerCase().includes(nameQuery.toLowerCase()) && c.name !== formData.name)
                          .slice(0, 10)
                          .map(c => (
                            <div key={c._id} className="combo-item" onMouseDown={() => handleSelectName(c.name)}>
                              {c.name}
                            </div>
                          ))
                        }
                      </div>
                    )}
                    {nameDuplicate && <div className="input-error-text" style={{color: 'red', fontSize: '12px'}}>มีชื่อลูกค้านี้ในระบบแล้ว</div>}
                  </div>
                </div>
              </div>

              {/* Row 2: Type & Size */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="customerType"><Building /> ประเภทลูกค้า <span className="required">*</span></label>
                  <div className="combo">
                    <input
                      type="text"
                      className={`form-control combo-input ${touched.customerType && !formData.customerType ? 'invalid' : ''}`}
                      placeholder="เลือกประเภทลูกค้า..."
                      value={formData.customerType}
                      onFocus={() => setShowTypeDropdown(true)}
                      readOnly
                    />
                    {showTypeDropdown && (
                      <div className="combo-panel" onMouseLeave={() => setShowTypeDropdown(false)}>
                        {customerTypeOptions.map(opt => (
                          <div 
                            key={opt} 
                            className={`combo-item ${formData.customerType === opt ? 'selected' : ''}`}
                            onMouseDown={() => {
                              setFormData(prev => ({ ...prev, customerType: opt }));
                              setShowTypeDropdown(false);
                              setTouched(prev => ({ ...prev, customerType: true }));
                            }}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="businessSize"><BriefcaseFill /> ขนาดธุรกิจ <span className="required">*</span></label>
                  <div className="combo">
                    <input
                      type="text"
                      className={`form-control combo-input ${touched.businessSize && !formData.businessSize ? 'invalid' : ''}`}
                      placeholder="เลือกขนาดธุรกิจ..."
                      value={formData.businessSize}
                      onFocus={() => setShowSizeDropdown(true)}
                      readOnly
                    />
                    {showSizeDropdown && (
                      <div className="combo-panel" onMouseLeave={() => setShowSizeDropdown(false)}>
                        {businessSizeOptions.map(opt => (
                          <div 
                            key={opt} 
                            className={`combo-item ${formData.businessSize === opt ? 'selected' : ''}`}
                            onMouseDown={() => {
                              setFormData(prev => ({ ...prev, businessSize: opt }));
                              setShowSizeDropdown(false);
                              setTouched(prev => ({ ...prev, businessSize: true }));
                            }}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Address */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="address"><Globe /> ที่อยู่ <span className="required">*</span></label>
                  <textarea
                    id="address"
                    name="address"
                    className={`form-input ${touched.address && (formData.address ? 'valid' : 'invalid')}`}
                    value={formData.address}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    rows={3}
                    placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
                    required
                  />
                </div>
              </div>

              {/* Row 4: Phone, Email */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone"><TelephoneFill /> เบอร์โทรศัพท์ <span className="required">*</span></label>
                  <input
                    type="number"
                    id="phone"
                    name="phone"
                    className={`form-input ${touched.phone && (formData.phone ? 'valid' : 'invalid')}`}
                    value={formData.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="0XX-XXX-XXXX"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email"><EnvelopeFill /> Email <span className="required">*</span></label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className={`form-input ${touched.email && (formData.email ? 'valid' : 'invalid')}`}
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>

              {/* Row 5: Contact Person & Tax ID */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="contactPerson"><PersonPlusFill /> ผู้ติดต่อ <span className="required">*</span></label>
                  <input
                    type="text"
                    id="contactPerson"
                    name="contactPerson"
                    className={`form-input ${touched.contactPerson && (formData.contactPerson ? 'valid' : 'invalid')}`}
                    value={formData.contactPerson}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="ชื่อ-นามสกุลผู้ติดต่อ"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="taxId"><CreditCard /> Tax ID <span className="required">*</span></label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="number"
                      id="taxId"
                      ref={taxIdInputRef}
                      name="taxId"
                      className={`form-input ${touched.taxId && (formData.taxId && !taxIdDuplicate ? 'valid' : 'invalid')}`}
                      value={formData.taxId}
                      onChange={handleChange}
                      onFocus={() => setShowTaxIdDropdown(true)}
                      onBlur={e => {
                        handleBlur(e);
                        setTimeout(() => setShowTaxIdDropdown(false), 200);
                      }}
                      placeholder="เลขประจำตัวผู้เสียภาษี"
                      autoComplete="off"
                      required
                      style={{ width: '100%' }}
                    />
                    {showTaxIdDropdown && taxIdQuery && (
                      <div className="combo-panel" style={{ zIndex: 10, maxHeight: 180, overflowY: 'auto', position: 'absolute', left: 0, right: 0 }}>
                        {allCustomers
                          .filter(c => (c.taxId || '').includes(taxIdQuery) && c.taxId !== formData.taxId)
                          .slice(0, 10)
                          .map(c => (
                            <div key={c._id} className="combo-item" onMouseDown={() => handleSelectTaxId(c.taxId)}>
                              {c.taxId}
                            </div>
                          ))
                        }
                        {allCustomers.filter(c => (c.taxId || '').includes(taxIdQuery) && c.taxId !== formData.taxId).length === 0 && (
                          <div className="combo-item disabled">ไม่พบ Tax ID ที่คล้ายกัน</div>
                        )}
                      </div>
                    )}
                    {taxIdDuplicate && <div className="input-error-text" style={{color: 'red', fontSize: '12px'}}>มี Tax ID นี้ในระบบแล้ว</div>}
                  </div>
                </div>
              </div>

              {/* Row 5: Tax ID & Product */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="taxId"><CreditCard /> Tax ID <span className="required">*</span></label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="number"
                      id="taxId"
                      ref={taxIdInputRef}
                      name="taxId"
                      className={`form-input ${touched.taxId && (formData.taxId && !taxIdDuplicate ? 'valid' : 'invalid')}`}
                      value={formData.taxId}
                      onChange={handleChange}
                      onFocus={() => setShowTaxIdDropdown(true)}
                      onBlur={e => {
                        handleBlur(e);
                        setTimeout(() => setShowTaxIdDropdown(false), 200);
                      }}
                      placeholder="เลขประจำตัวผู้เสียภาษี"
                      autoComplete="off"
                      required
                      style={{ width: '100%' }}
                    />
                    {showTaxIdDropdown && taxIdQuery && (
                      <div className="combo-panel" style={{ zIndex: 10, maxHeight: 180, overflowY: 'auto', position: 'absolute', left: 0, right: 0 }}>
                        {allCustomers
                          .filter(c => (c.taxId || '').includes(taxIdQuery) && c.taxId !== formData.taxId)
                          .slice(0, 10)
                          .map(c => (
                            <div key={c._id} className="combo-item" onMouseDown={() => handleSelectTaxId(c.taxId)}>
                              {c.taxId}
                            </div>
                          ))
                        }
                        {allCustomers.filter(c => (c.taxId || '').includes(taxIdQuery) && c.taxId !== formData.taxId).length === 0 && (
                          <div className="combo-item disabled">ไม่พบ Tax ID ที่คล้ายกัน</div>
                        )}
                      </div>
                    )}
                    {taxIdDuplicate && <div className="input-error-text" style={{color: 'red', fontSize: '12px'}}>มี Tax ID นี้ในระบบแล้ว</div>}
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="productService"><BriefcaseFill /> สินค้า / บริการ <span className="required">*</span></label>
                  <textarea
                    id="productService"
                    name="productService"
                    className={`form-input ${touched.productService && (formData.productService ? 'valid' : 'invalid')}`}
                    value={formData.productService}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    rows={3}
                    placeholder="ระบุสินค้าหรือบริการ"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={handleReset} disabled={isSubmitting}>
              <ArrowCounterclockwise /> ล้างข้อมูล
            </button>
            <button type="submit" className="btn-header-upload" disabled={isSubmitting || nameDuplicate}>
              {isSubmitting ? 'กำลังบันทึก...' : <><CheckCircleFill /> บันทึกข้อมูล</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}