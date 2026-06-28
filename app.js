// Main Application Logic for FIDO2 WebAuthn Passwordless Auth

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const navTabs = document.getElementById('navTabs');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const alertBox = document.getElementById('alertBox');
    const alertMessage = alertBox.querySelector('.alert-message');
    const alertIcon = alertBox.querySelector('.alert-icon');
    
    // Forms & Inputs
    const authForm = document.getElementById('authForm');
    const authUsernameInput = document.getElementById('authUsername');
    const regForm = document.getElementById('regForm');
    const regUsernameInput = document.getElementById('regUsername');
    const regFirstNameInput = document.getElementById('regFirstName');
    const regLastNameInput = document.getElementById('regLastName');
    const regPhoneInput = document.getElementById('regPhone');
    
    // Dashboard Elements
    const dashboardView = document.getElementById('dashboardView');
    const displayUsername = document.getElementById('displayUsername');
    const displayFullName = document.getElementById('displayFullName');
    const displayPhone = document.getElementById('displayPhone');
    const displayCredId = document.getElementById('displayCredId');
    const btnLogout = document.getElementById('btnLogout');
    
    // Security Context Panel
    const panelTrigger = document.getElementById('panelTrigger');
    const panelContent = document.getElementById('panelContent');
    const caretIcon = panelTrigger.querySelector('.caret-icon');

    let alertTimeout = null;

    // --- Tab Switching Logic ---
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            
            // Switch tabs
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show correct view
            tabContents.forEach(content => {
                if (content.id === target) {
                    content.classList.add('active-content');
                } else {
                    content.classList.remove('active-content');
                }
            });

            // If switching tabs, reset auth/reg state but keep dashboard if logged in
            if (target !== 'dashboardView') {
                dashboardView.classList.add('hidden-view');
            } else {
                // If dashboard is target, activate it
                dashboardView.classList.remove('hidden-view');
                tabContents.forEach(c => c.classList.remove('active-content'));
            }
        });
    });

    // --- Collapsible Security Panel ---
    panelTrigger.addEventListener('click', () => {
        panelContent.classList.toggle('hidden-panel');
        caretIcon.classList.toggle('rotated');
    });

    // --- Alert System helper ---
    function showAlert(message, type = 'info', duration = 6000) {
        if (alertTimeout) clearTimeout(alertTimeout);
        
        alertBox.className = 'alert-box'; // reset classes
        alertBox.classList.add(type);
        alertMessage.textContent = message;
        
        // Update icons based on type
        alertIcon.className = 'alert-icon fa-solid';
        if (type === 'success') {
            alertIcon.classList.add('fa-circle-check');
        } else if (type === 'error') {
            alertIcon.classList.add('fa-triangle-exclamation');
        } else {
            alertIcon.classList.add('fa-circle-info');
        }
        
        alertBox.classList.remove('hidden');
        
        alertTimeout = setTimeout(() => {
            alertBox.classList.add('hidden');
        }, duration);
    }

    // --- Check FIDO2 / WebAuthn Browser Support ---
    function checkSupport() {
        // 1. ตรวจสอบการเปิดใช้หน้าเว็บผ่าน file:// (ไม่รองรับ WebAuthn)
        if (window.location.protocol === 'file:') {
            showAlert('คำเตือน: WebAuthn ไม่อนุญาตให้ทำงานผ่านโปรโตคอล file:// กรุณาเปิดผ่าน localhost หรือโฮสติ้งที่เป็น HTTPS เท่านั้น!', 'error', 15000);
            return false;
        }

        // 2. ตรวจสอบว่าบราว์เซอร์มี PublicKeyCredential หรือไม่
        if (!window.PublicKeyCredential) {
            showAlert('เบราว์เซอร์หรืออุปกรณ์ของคุณไม่รองรับระบบ FIDO2/WebAuthn กรุณาใช้ Chrome, Safari หรือ Edge รุ่นล่าสุด', 'error', 10000);
            return false;
        }
        
        return true;
    }

    const isSupported = checkSupport();

    // --- Mock Database Helper (LocalStorage) ---
    const DB = {
        getUsers: function() {
            const data = localStorage.getItem('fido2_mock_users');
            return data ? JSON.parse(data) : {};
        },
        getUser: function(username) {
            const users = this.getUsers();
            return users[username.trim().toLowerCase()] || null;
        },
        saveUser: function(user) {
            const users = this.getUsers();
            const key = user.username.trim().toLowerCase();
            users[key] = user;
            localStorage.setItem('fido2_mock_users', JSON.stringify(users));
        }
    };

    // --- 1. FIDO2 Registration (ลงทะเบียนผู้ใช้ใหม่) ---
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!isSupported && !checkSupport()) {
            showAlert('ไม่สามารถลงทะเบียนได้เนื่องจากเบราว์เซอร์ไม่สนับสนุน', 'error');
            return;
        }

        const username = regUsernameInput.value.trim();
        const firstName = regFirstNameInput.value.trim();
        const lastName = regLastNameInput.value.trim();
        const phone = regPhoneInput.value.trim();
        
        const authenticatorType = document.querySelector('input[name="authenticatorType"]:checked').value;

        // ตรวจสอบความถูกต้องเบื้องต้น
        if (!username || !firstName || !lastName || !phone) {
            showAlert('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง', 'error');
            return;
        }

        // ตรวจสอบว่าชื่อผู้ใช้นี้ซ้ำหรือไม่
        if (DB.getUser(username)) {
            showAlert(`ขออภัย: ชื่อผู้ใช้งาน @${username} มีผู้ใช้ลงทะเบียนไว้แล้ว`, 'error');
            return;
        }

        try {
            showAlert('กรุณาสแกนลายนิ้วมือ ใบหน้า หรือคีย์ความปลอดภัยเมื่อระบบเรียกถาม...', 'info');

            // 1. สร้าง Challenge และ User ID
            const challengeBuffer = WebAuthnHelper.generateChallenge();
            const userIdBuffer = WebAuthnHelper.stringToBuffer(username);

            // 2. กำหนดค่าตัวเลือก (PublicKeyCredentialCreationOptions) ตามมาตรฐาน FIDO2
            const rpId = window.location.hostname || "localhost";
            const publicKeyCredentialCreationOptions = {
                challenge: challengeBuffer,
                rp: {
                    name: "FIDO2 Passwordless Demo Site",
                    id: rpId
                },
                user: {
                    id: userIdBuffer,
                    name: username,
                    displayName: `${firstName} ${lastName}`
                },
                pubKeyCredParams: [
                    { alg: -7, type: "public-key" },   // ES256 (ECDSA w/ SHA-256) - นิยมสุดบน iOS, Android, macOS
                    { alg: -257, type: "public-key" }  // RS256 (RSA w/ SHA-256) - นิยมบน Windows Hello
                ],
                timeout: 60000,
                authenticatorSelection: {
                    authenticatorAttachment: authenticatorType, // 'platform' (นิ้วมือเครื่อง) หรือ 'cross-platform' (USB key)
                    userVerification: "required", // บังคับให้ยืนยันตัวตน (PIN หรือ Bio)
                    residentKey: "preferred"
                },
                attestation: "none" // ใน Demo นี้ไม่ตรวจสอบข้อมูลจำเพาะของเครื่องผู้ผลิตชิป
            };

            console.log('เรียกใช้ navigator.credentials.create พร้อมตัวเลือก:', publicKeyCredentialCreationOptions);
            
            // 3. เรียก WebAuthn API ฝั่ง Client
            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions
            });

            if (!credential) {
                throw new Error('เบราว์เซอร์ไม่คืนค่าข้อมูล Credential');
            }

            console.log('ลงทะเบียนสำเร็จ! ได้รับข้อมูล credential:', credential);

            // 4. แปลงข้อมูล ArrayBuffer เป็น Base64 เพื่อจัดเก็บลง LocalStorage (Mock Backend)
            const credentialId = credential.id; // เป็น string อยู่แล้ว
            const rawIdBase64 = WebAuthnHelper.bufferToBase64URL(credential.rawId);
            
            // เก็บข้อมูลผู้ใช้ลงใน Mock Database
            const newUser = {
                username: username,
                firstName: firstName,
                lastName: lastName,
                phone: phone,
                credentialId: credentialId,
                rawId: rawIdBase64,
                registeredAt: new Date().toISOString()
            };

            DB.saveUser(newUser);
            
            showAlert(`ลงทะเบียนสำเร็จ! ยินดีต้อนรับคุณ ${firstName} ${lastName}`, 'success');
            regForm.reset();

            // เปลี่ยนหน้าจอไปที่หน้าล็อกอินโดยอัตโนมัติ
            setTimeout(() => {
                const authTabBtn = document.getElementById('tabBtnAuth');
                authTabBtn.click();
                authUsernameInput.value = username; // กรอก Username ให้ผู้ใช้เลยเพื่อความสะดวก
            }, 1500);

        } catch (error) {
            console.error('Registration Error:', error);
            if (error.name === 'NotAllowedError') {
                showAlert('การลงทะเบียนล้มเหลว: ผู้ใช้ยกเลิกการสแกน หรือหมดเวลาดำเนินการ', 'error');
            } else if (error.name === 'InvalidStateError') {
                showAlert('อุปกรณ์ชิ้นนี้เคยลงทะเบียนบัญชีนี้ไว้แล้ว', 'error');
            } else {
                showAlert(`เกิดข้อผิดพลาด: ${error.message || error.name}`, 'error');
            }
        }
    });

    // --- 2. FIDO2 Authentication (การยืนยันตัวตนเข้าสู่ระบบ) ---
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!isSupported && !checkSupport()) {
            showAlert('ไม่สามารถเข้าสู่ระบบได้เนื่องจากเบราว์เซอร์ไม่สนับสนุน', 'error');
            return;
        }

        const username = authUsernameInput.value.trim();

        if (!username) {
            showAlert('กรุณากรอกชื่อผู้ใช้งาน', 'error');
            return;
        }

        // ค้นหาข้อมูลผู้ใช้ในระบบจำลอง
        const user = DB.getUser(username);
        if (!user) {
            showAlert(`ไม่พบผู้ใช้งาน @${username} ในระบบจำลองนี้ กรุณาสมัครสมาชิกก่อน`, 'error');
            return;
        }

        try {
            showAlert('กรุณาสแกนนิ้วมือ ใบหน้า หรือป้อน PIN ของเครื่องเพื่อยืนยันตัวตน...', 'info');

            // 1. สร้าง Challenge แบบสุ่มสำหรับด่านล็อกอิน
            const challengeBuffer = WebAuthnHelper.generateChallenge();

            // 2. แปลง Credential ID ของผู้ใช้ที่เคยเซฟไว้กลับมาเป็น ArrayBuffer เพื่อบอกให้อุปกรณ์รับรู้
            const allowedCredentialIdBuffer = WebAuthnHelper.base64URLToBuffer(user.credentialId);

            // 3. ตั้งค่าตัวเลือกขอตรวจสอบสิทธิ์ (PublicKeyCredentialRequestOptions)
            const rpId = window.location.hostname || "localhost";
            const publicKeyCredentialRequestOptions = {
                challenge: challengeBuffer,
                timeout: 60000,
                rpId: rpId,
                allowCredentials: [{
                    id: allowedCredentialIdBuffer,
                    type: "public-key"
                }],
                userVerification: "required" // ต้องยืนยันตัวตนด้วย Biometric หรือ PIN
            };

            console.log('เรียกใช้ navigator.credentials.get พร้อมตัวเลือก:', publicKeyCredentialRequestOptions);

            // 4. เรียก WebAuthn API ยืนยันตัวตนกับชิปฮาร์ดแวร์
            const assertion = await navigator.credentials.get({
                publicKey: publicKeyCredentialRequestOptions
            });

            if (!assertion) {
                throw new Error('ยืนยันตัวตนล้มเหลว เบราว์เซอร์ไม่ส่งคืนผลลัพธ์');
            }

            console.log('สแกนเสร็จสิ้น ได้รับผลลัพธ์การทวนสอบ (assertion):', assertion);

            // 5. [Mock Verification] 
            // ในระบบจริง จะส่ง assertion ไปให้ Backend ตรวจสอบค่า Signature และค่า Challenge
            // แต่สำหรับ Mock Backend ใน Localhost ตัว browser.credentials.get() ที่เสร็จสิ้นโดยไม่โยน Error
            // ก็เป็นหลักฐานการันตีเพียงพอว่าผู้ใช้ได้ใช้นิ้วมือ/ใบหน้าจริงกับชิปความปลอดภัยที่ถือครองกุญแจส่วนตัว

            showAlert('ยืนยันตัวตนเสร็จสิ้น ยินดีต้อนรับเข้าสู่ระบบ', 'success');
            
            // แสดงหน้าจอ Dashboard ข้อมูลเข้าสู่ระบบสำเร็จ
            setTimeout(() => {
                showDashboard(user);
            }, 1000);

        } catch (error) {
            console.error('Authentication Error:', error);
            if (error.name === 'NotAllowedError') {
                showAlert('การยืนยันตัวตนล้มเหลว: ผู้ใช้ยกเลิกการสแกน หรือระบบหมดเวลา', 'error');
            } else {
                showAlert(`เกิดข้อผิดพลาดในการล็อกอิน: ${error.message || error.name}`, 'error');
            }
        }
    });

    // --- Show Success Dashboard ---
    function showDashboard(user) {
        // ตั้งค่าข้อมูลผู้ใช้ขึ้นแสดงผล
        displayUsername.textContent = `@${user.username}`;
        displayFullName.textContent = `${user.firstName} ${user.lastName}`;
        displayPhone.textContent = user.phone;
        
        // ตัดข้อความส่วนหนึ่งของ Credential ID เพื่อความสวยงามในหน้า UI
        const displayCred = user.credentialId.length > 30 
            ? user.credentialId.substring(0, 15) + '...' + user.credentialId.substring(user.credentialId.length - 15)
            : user.credentialId;
        displayCredId.textContent = displayCred;
        displayCredId.title = user.credentialId; // เก็บค่าจริงไว้ใน tooltip

        // ซ่อนแท็บอื่นๆ และสลับไปที่หน้า Dashboard
        tabContents.forEach(content => content.classList.remove('active-content'));
        tabButtons.forEach(btn => btn.classList.remove('active'));
        
        dashboardView.classList.remove('hidden-view');
        dashboardView.classList.add('active-content');
    }

    // --- 3. Log Out (ออกจากระบบ) ---
    btnLogout.addEventListener('click', () => {
        dashboardView.classList.add('hidden-view');
        dashboardView.classList.remove('active-content');
        
        // สลับกลับหน้าล็อกอินดั้งเดิม
        const authTabBtn = document.getElementById('tabBtnAuth');
        authTabBtn.click();
        
        authForm.reset();
        showAlert('ออกจากระบบสำเร็จแล้ว', 'info');
    });
});
