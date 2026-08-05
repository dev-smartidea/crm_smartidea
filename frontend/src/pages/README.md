# Frontend Pages Summary

เอกสารนี้สรุปโครงสร้างหน้าใน `frontend/src/pages` ของ CRM SmartIdea โดยแบ่งตามกลุ่ม role และ workflow หลักของระบบ

## ภาพรวมโฟลเดอร์

`frontend/src/pages` แบ่งเป็น 5 กลุ่มหลัก

- `auth`: หน้าเข้าสู่ระบบและสมัครสมาชิก
- `shared`: หน้าที่ใช้ร่วมกันหลาย role เช่น dashboard, notification, gallery
- `user`: หน้าทำงานของผู้ใช้ทั่วไป/ทีมขาย/ผู้ดูแลลูกค้า
- `account`: หน้าทีมบัญชีและงานการเงิน
- `admin`: หน้า admin และ manager สำหรับดูแลระบบ/บริการ/ข้อมูลรวม

ไฟล์ `.css` ในแต่ละโฟลเดอร์เป็น style เฉพาะหน้าหรือถูก reuse ระหว่างหน้าที่หน้าตาคล้ายกัน เช่น transaction cards, dashboard cards, table layout และ modal

## Auth Pages

### `auth/LoginPage.js`

หน้าเข้าสู่ระบบ

- ส่ง username/password ไปที่ `POST /api/auth/login`
- เมื่อ login สำเร็จจะเก็บ JWT token ใน `localStorage`
- เรียก `onLoginSuccess` เพื่อให้ `App.js` อ่าน token/role ใหม่
- role ใน token ถูกใช้กำหนด redirect ไป dashboard ที่เหมาะสม

### `auth/RegisterPage.js`

หน้าสมัครสมาชิก

- ส่งข้อมูลไปที่ `POST /api/auth/register`
- ใช้สำหรับสร้างบัญชีผู้ใช้พื้นฐาน
- มี state สำหรับ form, loading, error/success message

## Shared Pages

### `shared/DashboardPage.js`

หน้า dashboard หลักของ user ทั่วไป

- โหลดข้อมูล summary จาก `GET /api/dashboard/summary`
- โหลด notification จาก `GET /api/notifications`
- แสดงภาพรวมลูกค้า/บริการ/รายการโอน/สถานะงาน
- เป็นหน้า index ภายใต้ `/dashboard`

### `shared/AccountDashboardPage.js`

หน้า dashboard ของทีมบัญชี

- โหลดข้อมูลจากหลาย API เช่น:
  - `GET /api/dashboard/summary`
  - `GET /api/cards`
  - `GET /api/cards/ledger/all`
  - `GET /api/transactions`
- คำนวณยอดตามช่วงเวลา เช่น ยอดอนุมัติ, ยอดเติม, ยอดตัดบัตร
- ใช้สำหรับมองภาพรวมการเงินและ card balance

### `shared/NotificationPage.js`

หน้า notification รวม

- แสดงรายการแจ้งเตือนของผู้ใช้ที่ login อยู่
- ใช้ API กลุ่ม `/api/notifications`
- รองรับการ mark read / ดูรายการแจ้งเตือนที่เกี่ยวกับ service, transaction, card และระบบ

### `shared/ImageGalleryPage.js`

คลังรูปภาพ/ไฟล์ภาพของลูกค้าและบริการ

- โหลดลูกค้าจาก `GET /api/customers`
- โหลดบริการของลูกค้าจาก `GET /api/customers/:customerId/services`
- โหลดรูปจาก `GET /api/images`
- อัปโหลดรูปด้วย `POST /api/images`
- ลบรูปด้วย `DELETE /api/images/:id`
- มี filter ตามลูกค้า, service, pagination และ modal preview

### `shared/UserDashboardPage.css`

เป็น style เก่าหรือ style เฉพาะ dashboard user ไม่มีไฟล์ `.js` คู่ในโฟลเดอร์นี้

## User Pages

### `user/AddCustomerPage.js`

หน้าเพิ่มลูกค้าใหม่

- โหลดลูกค้าปัจจุบันเพื่อช่วยตรวจ duplicate
- โหลด preview customer code จาก `GET /api/customers/preview`
- โหลดรายชื่อ user จาก `GET /api/auth/users`
- สร้างลูกค้าด้วย `POST /api/customers`
- มี logic ตรวจเลขประจำตัว/ข้อมูลซ้ำ, sync field, เลือกเจ้าของลูกค้า และจัดการ form state หลายส่วน

### `user/CustomerListPage.js`

หน้ารายชื่อลูกค้า

- ค้นหาลูกค้าด้วย `GET /api/customers?search=...`
- ลบลูกค้าด้วย `DELETE /api/customers/:id`
- โหลด service ของลูกค้าบางจุดด้วย `GET /api/customers/:customerId/services`
- ใช้เป็น entry point ไปหน้า detail และ service ของลูกค้า

### `user/CustomerDetailPage.js`

หน้ารายละเอียดลูกค้า

- โหลดลูกค้าจาก `GET /api/customers/:id`
- โหลด user list สำหรับแก้เจ้าของ/ผู้รับผิดชอบ
- แก้ไขลูกค้าด้วย `PUT /api/customers/:id`
- แสดงข้อมูลบริษัท/ผู้ติดต่อ/ที่อยู่/หมายเหตุ และ modal แก้ไข

### `user/CustomerServicesPage.js`

หน้าบริการของลูกค้ารายหนึ่ง

- โหลดลูกค้าและบริการจาก:
  - `GET /api/customers/:id`
  - `GET /api/customers/:id/services`
  - `GET /api/auth/users/list`
- สร้างบริการด้วย `POST /api/customers/:id/services`
- แก้ไขบริการด้วย `PUT /api/services/:serviceId`
- ลบบริการด้วย `DELETE /api/services/:serviceId`
- รองรับ Google Ads, Facebook Ads และเว็บไซต์
- มี flow อัปเดตวันเริ่ม/วันครบกำหนด, สถานะบริการ, caretaker, cid และข้อมูลเฉพาะ service

### `user/TransactionHistoryPage.js`

หน้าประวัติการโอนเงินของ service เดียว

- Route ใช้ `serviceId`
- โหลด service และ transactions จาก:
  - `GET /api/services/:serviceId`
  - `GET /api/services/:serviceId/transactions`
- เพิ่มรายการโอนด้วย `POST /api/services/:serviceId/transactions`
- แก้ไขรายการโอนด้วย `PUT /api/transactions/:id`
- ลบรายการโอนด้วย `DELETE /api/transactions/:id`
- ลบสลิปด้วย `DELETE /api/transactions/:id/slip`
- รองรับ upload slip ผ่าน `FormData`
- มี breakdown codes สำหรับแยกยอด เช่น ค่าคลิก, VAT, หัก ณ ที่จ่าย, ค่าบริการ Google/Facebook/Hosting
- มี status note เช่น `รอบันทึกบัญชี` และ `ค่าคลิกที่ยังไม่ต้องเติม`

### `user/AllTransactionPage.js`

หน้ารายการเติมเงิน/โอนเงินทั้งหมด

- โหลดข้อมูลรวมจาก:
  - `GET /api/customers`
  - `GET /api/services`
  - `GET /api/transactions?limit=500`
- สร้าง transaction ได้หลายรายการจากหน้าเดียว
- ส่งรายการให้บัญชีด้วย `PUT /api/transactions/:id/submit`
- แก้ไข/ลบ transaction และจัดการ slip
- มี pagination, filter, modal preview slip, form breakdown และ validation ยอดรวม breakdown
- เป็นหน้ารวมสำหรับ user ที่ต้องการจัดการรายการโอนหลาย service

### `user/SubmittedTransactionsPage.js`

หน้ารายการที่ user ส่งไปบัญชีแล้ว

- โหลดรายการตาม tab:
  - submitted
  - approved
  - rejected
  - funded
- ใช้ `GET /api/transactions?submissionStatus=...`
- รายการ funded ใช้ `GET /api/transactions?funded=true`
- รองรับแก้/อัปโหลดสลิป/ลบ/ยกเลิกบางรายการ
- ใช้ดูสถานะหลังส่งบัญชี

### `user/DueCustomersPage.js`

หน้าลูกค้าครบกำหนด

- โหลดข้อมูลจาก `GET /api/services/due-monthly`
- แสดงบริการที่ครบกำหนดตามเดือน/ปี
- filter ได้ตามผู้ดูแล, service type, สถานะชำระเงิน
- แก้ service ด้วย `PUT /api/services/:serviceId`
- ใช้ร่วมได้หลาย role เพราะ route มีทั้งใน user, account และ admin layout

### `user/CustomerActivitiesPage.js`

หน้ากิจกรรมของลูกค้า

- โหลดลูกค้าจาก `GET /api/customers/:customerId`
- โหลดกิจกรรมจาก `GET /api/customers/:customerId/activities`
- เพิ่มกิจกรรมด้วย `POST /api/customers/:customerId/activities`
- แก้ไขด้วย `PUT /api/activities/:id`
- ลบด้วย `DELETE /api/activities/:id`
- mark complete ด้วย `PUT /api/activities/:id/complete`

### `user/AllActivitiesPage.js`

หน้ากิจกรรมทั้งหมด

- โหลดทุกกิจกรรมจาก `GET /api/activities`
- แก้ไข/ลบกิจกรรมด้วย `/api/activities/:id`
- เหมาะสำหรับดูงาน follow-up ทั้งหมดในระบบ

### `user/ProfilePage.js`

หน้า profile ผู้ใช้

- โหลด profile จาก `GET /api/auth/profile`
- อัปโหลด avatar ด้วย `POST /api/auth/upload-avatar`
- แก้ไขข้อมูลส่วนตัวด้วย `PATCH /api/auth/profile`
- ใช้ `localStorage` token และแสดง preview รูป

### `user/UserDetailPage.js`

หน้ารายละเอียด user สำหรับ admin wrapper ใน `App.js`

- รับ `user` และ `onBack` เป็น props
- โหลดลูกค้าของ user ด้วย `GET /api/customers?userId=...`
- โหลด transaction ล่าสุดด้วย `GET /api/transactions?userId=...`
- เปลี่ยน role ด้วย `PATCH /api/auth/users/:id/role`
- ลบลูกค้าบางรายการด้วย `DELETE /api/customers/:id`
- เป็นหน้าดู performance/ข้อมูลเจ้าของลูกค้าแบบเจาะ user

## Account Pages

### `account/AccountTransactionsPage.js`

หน้ารายการที่ส่งมาบัญชีและรอพิจารณา

- โหลดรายการ `submitted` จาก `GET /api/transactions?submissionStatus=submitted`
- อนุมัติด้วย `PUT /api/transactions/:id/approve`
- อนุมัติหลายรายการด้วย `PUT /api/transactions/bulk-approve`
- ปฏิเสธด้วย `PUT /api/transactions/:id/reject`
- อัปโหลด/ลบ slip ได้
- มี filter รายการที่มีค่าบริการและรายการอื่น ๆ
- ปุ่ม approve ถูก disable ถ้าไม่มี slip

### `account/ApprovedTransactionsPage.js`

หน้ารายการที่อนุมัติแล้ว

- โหลดจาก `GET /api/transactions?submissionStatus=approved`
- แก้ไข transaction และ slip ได้
- ปฏิเสธย้อนหลังได้ด้วย `PUT /api/transactions/:id/reject`
- มี modal แก้ไขข้อมูลบัญชี เช่น bank, amount, breakdown, slip
- ใช้ตรวจสอบรายการบัญชีหลังอนุมัติ

### `account/RejectedTransactionsPage.js`

หน้ารายการที่ปฏิเสธ

- โหลดจาก `GET /api/transactions?submissionStatus=rejected`
- ใช้ดูรายการที่ถูก reject พร้อมรายละเอียดลูกค้า/service/breakdown/slip
- มี pagination และ UI คล้ายหน้า approved/submitted

### `account/AccountLedgerPage.js`

หน้าสมุดบัญชีหลักของ account

- โหลด ledger จาก `GET /api/ledger`
- แก้ field ledger ด้วย `PATCH /api/ledger/:id`
- export ด้วย `GET /api/ledger/export`
- โหลด card history จาก `GET /api/cards/charge-history/:transactionId`
- โหลดบัตรจาก `GET /api/cards`
- ตัด/เติมบัตรผ่าน `POST /api/cards/charge`
- รองรับ flow Google/Facebook:
  - Google charge
  - Facebook topup รอ FB ตัด
  - Facebook record charged amount
- เป็นหน้าที่ซับซ้อนที่สุดของบัญชี เพราะรวมการแก้ ledger, บัตร, breakdown, export และ modal หลายแบบ

### `account/AccountCardsPage.js`

หน้าจัดการบัตร

- โหลดบัตรจาก `GET /api/cards`
- โหลดบริการจาก `GET /api/services`
- เติมบัตรด้วย `POST /api/cards/topup`
- ตัดบัตรด้วย `POST /api/cards/charge`
- สร้างบัตรด้วย `POST /api/cards`
- แก้ไขบัตรด้วย `PUT /api/cards/:id`
- ลบบัตรด้วย `DELETE /api/cards/:id`
- ใช้ดู balance, channel ที่รองรับ, status และ action card

### `account/AccountCardLedgerPage.js`

หน้าประวัติบัตรรายใบ

- Route ใช้ `cardId`
- โหลดจาก `GET /api/cards/:cardId/ledger`
- ลบ ledger entry ด้วย `DELETE /api/cards/ledger/:ledgerEntryId`
- มี filter, pagination, summary credit/debit และ export link ตาม card

### `account/AccountCardDailySummaryPage.js`

หน้าสรุปตัดบัตรรายวันของ account

- โหลดจาก `GET /api/cards/daily-summary?date=YYYY-MM-DD`
- มีโหมดช่วงเวลา เช่น วันนี้, สัปดาห์นี้, เดือนนี้
- รวมรายการ charge และ topup จาก CardLedger
- มี pagination และ filter ประเภท
- ใช้ตรวจยอดบัตรรายวันจากฝั่ง account

### `account/AccountFacebookPage.js`

หน้าบริการ/ledger เฉพาะ Facebook Ads

- โหลด ledger ด้วย `GET /api/ledger?serviceType=Facebook+Ads`
- ค้นหาลูกค้าด้วย `GET /api/customers?search=...`
- โอน service ด้วย `POST /api/services/:serviceId/transfer`
- โหลดบัตรด้วย `GET /api/cards`
- แก้ ledger ด้วย `PATCH /api/ledger/:id`
- แก้ service ด้วย `PUT /api/services/:serviceId`
- ตัด/บันทึกยอด Facebook ผ่าน `POST /api/cards/charge`
- มี logic เฉพาะ Facebook เช่น transfer account, offset, topup/charged state

### `account/AccountGooglePage.js`

หน้าบริการ/ledger เฉพาะ Google Ads

- โครงคล้าย `AccountFacebookPage`
- ใช้ ledger filter serviceType Google Ads
- ใช้จัดการยอด Google, service date, balance offset และการบันทึกการตัดบัตร

### `account/AccountNotificationPage.js`

หน้า notification สำหรับ account

- เป็นหน้ารวมแจ้งเตือนของ role account
- ใช้ pattern ใกล้กับ `shared/NotificationPage`
- แยกไว้เพื่อ route/layout ของ account

### `account/ClickCreditPage.js`

หน้าเครดิตค่าคลิกล่วงหน้า

- โหลดเครดิตจาก `GET /api/click-credits`
- โหลด transaction ที่ approved จาก `GET /api/transactions?submissionStatus=approved`
- สร้างเครดิตจาก transaction ด้วย `POST /api/click-credits/from-transaction/:transactionId`
- ใช้เครดิตรายเดือนด้วย `POST /api/click-credits/:id/use`
- role ที่จัดการได้ใน frontend คือ `account` และ `admin`
- manager role จะเห็นแบบอ่านอย่างเดียวตามสิทธิ์ API
- ใช้กับกรณีลูกค้าโอนเงินก้อนใหญ่ต้นปี แล้วต้องทยอยเติม/ใช้ค่าคลิกในแต่ละเดือน

## Admin Pages

### `admin/AdminDashboardPage.js`

หน้า dashboard/admin control หลัก

- โหลด users จาก `GET /api/auth/users`
- โหลด stats จาก `GET /api/admin/stats`
- โหลด customers จาก `GET /api/customers`
- สร้าง user ด้วย `POST /api/auth/admin/create-user`
- เปลี่ยน role ด้วย `PATCH /api/auth/users/:id/role`
- reset password ด้วย `PATCH /api/auth/users/:id/reset-password`
- ลบ user ด้วย `DELETE /api/auth/users/:id`
- ตั้ง serviceTypeScope ด้วย `PATCH /api/auth/users/:id/serviceTypeScope`
- ลบ/โอน customer ownership ด้วย API customer
- มี pagination สำหรับ user และ customer
- เป็นหน้าจัดการผู้ใช้และข้อมูลลูกค้าระดับระบบ

### `admin/AdminServicesPage.js`

หน้าบริการทั้งหมด

- โหลด:
  - `GET /api/services`
  - `GET /api/customers`
  - `GET /api/auth/users/list`
- สร้างบริการด้วย `POST /api/customers/:customerId/services`
- แก้ไขบริการด้วย `PUT /api/services/:serviceId`
- ลบบริการด้วย `DELETE /api/services/:serviceId`
- มี filter/search/sort/pagination
- ใช้ดูบริการทุกลูกค้าแบบรวมศูนย์

### `admin/AdminLedgerPage.js`

หน้าสมุดบัญชีฝั่ง admin

- โหลด ledger จาก `GET /api/ledger`
- แก้ ledger ด้วย `PATCH /api/ledger/:id`
- export ด้วย `GET /api/ledger/export`
- คล้าย account ledger แต่เน้นดู/ตรวจ/แก้ข้อมูลรวมจากมุม admin

### `admin/AdminCardDailySummaryPage.js`

หน้าสรุปตัดบัตรรายวันฝั่ง admin

- โหลดจาก `GET /api/cards/daily-summary?date=YYYY-MM-DD`
- แสดง charge/topup รายวัน
- pagination มากกว่า account page (`itemsPerPage` 50)
- ใช้ตรวจรายการบัตรแบบ admin

### `admin/AuditLogPage.js`

หน้า audit log

- โหลด log จาก `GET /api/audit`
- rollback log ด้วย `POST /api/audit/:id/rollback`
- มี filter/page และ modal/action สำหรับ rollback
- ใน `App.js` จำกัด route ให้เฉพาะ role `admin`

## Flow สำคัญใน Pages

### Flow รายการโอนเงิน

1. User เพิ่ม transaction ใน `TransactionHistoryPage` หรือ `AllTransactionPage`
2. User แนบ slip และ breakdown
3. User ส่งรายการด้วย `PUT /api/transactions/:id/submit`
4. Account ดูใน `AccountTransactionsPage`
5. Account อนุมัติ/ปฏิเสธ
6. รายการ approved ไปปรากฏใน ledger/account pages
7. Account ใช้ `AccountLedgerPage`, `AccountFacebookPage`, `AccountGooglePage` หรือ `AccountCardsPage` เพื่อจัดการเติม/ตัดบัตร

### Flow บัตร

1. Account/Admin โหลดบัตรจาก `/api/cards`
2. เติมบัตรผ่าน `/api/cards/topup`
3. ตัดบัตรผ่าน `/api/cards/charge`
4. ระบบบันทึก `CardLedger`
5. ดูประวัติรายใบใน `AccountCardLedgerPage`
6. ดูสรุปรายวันใน `AccountCardDailySummaryPage` หรือ `AdminCardDailySummaryPage`

### Flow เครดิตค่าคลิกล่วงหน้า

1. รายการโอนต้อง approved ก่อน
2. Account/Admin เปิด `ClickCreditPage`
3. เลือก transaction ที่มี breakdown ค่าคลิก
4. กำหนดยอดเครดิต, เดือนเริ่มต้น, จำนวนเดือน
5. ระบบสร้าง schedule รายเดือน
6. แต่ละเดือนกดใช้เครดิตเพื่อหักยอดคงเหลือ

## Role และการเข้าถึงหน้า

การ route หลักอยู่ใน `frontend/src/App.js`

- `user`: เข้า `/dashboard` และหน้ากลุ่ม user/shared
- `account`: เข้า `/dashboard/account` และหน้ากลุ่ม account/shared
- `admin`: เข้า `/dashboard/admin` และหน้ากลุ่ม admin
- `google_manager`, `facebook_manager`: เข้า admin layout บางส่วน และถูกจำกัดข้อมูลด้วย backend scope ในหลาย API

ข้อควรระวัง: frontend ซ่อน/แสดงเมนูตาม role ได้ระดับหนึ่ง แต่สิทธิ์จริงควรยืนยันที่ backend เสมอ เพราะผู้ใช้สามารถเรียก API ตรงได้

## ข้อสังเกตทางเทคนิค

- หลายหน้ามี logic ซ้ำกันเรื่อง transaction breakdown, slip modal, pagination และ format currency/date
- มี utility กลางบางส่วนใน `frontend/src/utils/transactionHelpers.js`
- บางข้อความในไฟล์เก่าแสดง encoding เพี้ยนใน source แต่ runtime อาจยังทำงานตามข้อมูลเดิม
- หน้า account ledger และ Facebook/Google page มี business logic หนาแน่น ควรระวังเป็นพิเศษเวลาแก้ flow บัตรหรือ transaction
- CSS หลายไฟล์ถูก reuse ข้ามหน้า เช่น `AllTransactionPage.css`, `DashboardPage.css`, `ImageGalleryPage.css`
- หลายหน้าพึ่ง `localStorage.getItem('token')` โดยตรง ถ้ามีการเปลี่ยน auth flow ควรตรวจทุกหน้า

## ไฟล์ที่ควรอ่านคู่กัน

- `frontend/src/App.js`: route และ role redirect
- `frontend/src/components/DashboardLayout.js`: layout user
- `frontend/src/components/AccountDashboardLayout.js`: layout account
- `frontend/src/components/AdminDashboardLayout.js`: layout admin/manager
- `frontend/src/utils/transactionHelpers.js`: format และ label ของ transaction
- `backend/routes/transactionRoutes.js`: API รายการโอน
- `backend/routes/ledgerRoutes.js`: API ledger
- `backend/routes/cardRoutes.js`: API บัตร
- `backend/routes/serviceRoutes.js`: API service
