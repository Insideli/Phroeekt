import React, { useState, useEffect, Component } from 'react';
import GuestApp from './GuestApp.jsx';
import StaffApp from './StaffApp.jsx';
import { INITIAL_CUSTOMERS, INITIAL_ROLES, useLocalStorage } from './data.js';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', backgroundColor: '#fee2e2', color: '#991b1b', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>🚨 Ошибка:</h2>
          <p>{this.state.error?.toString()}</p>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ padding: '12px 20px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Сбросить кэш</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [showSplash, setShowSplash] = useState(true);
  const [customers, setCustomers] = useLocalStorage('amina_customers_v11', INITIAL_CUSTOMERS);
  const [roles, setRoles] = useLocalStorage('amina_roles_v11', INITIAL_ROLES);
  const [analytics, setAnalytics] = useLocalStorage('amina_analytics_v11', { qr: 0, link: 0 });
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [currentUser, setCurrentUser] = useState({ role: 'guest', phone: '', name: '', station: null, isSenior: false, sessionToken: null }); 
  
  const [authMode, setAuthMode] = useState('login_guest'); 
  const [authStep, setAuthStep] = useState('phone'); 
  const [tempPhone, setTempPhone] = useState('+7'); 
  const [tempCode, setTempCode] = useState('');
  const [tempName, setTempName] = useState(''); 
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref === 'qr') { setAnalytics(prev => ({ ...prev, qr: (prev?.qr || 0) + 1 })); window.history.replaceState(null, '', window.location.pathname); } 
    else if (ref === 'link') { setAnalytics(prev => ({ ...prev, link: (prev?.link || 0) + 1 })); window.history.replaceState(null, '', window.location.pathname); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // ВЫШИБАЛА: Проверяем токен сессии каждые 3 секунды
  useEffect(() => {
    if (isAuthenticated && currentUser.phone && currentUser.role !== 'guest') {
      const interval = setInterval(() => {
        const currentData = JSON.parse(window.localStorage.getItem('amina_roles_v11') || '{}');
        const dbToken = currentData[currentUser.phone]?.sessionToken;
        if (dbToken && dbToken !== currentUser.sessionToken) {
          alert("⚠️ Ваш аккаунт был открыт на другом устройстве! Сессия завершена в целях безопасности.");
          setIsAuthenticated(false);
          setCurrentUser({ role: 'guest', phone: '', name: '', station: null, isSenior: false, sessionToken: null });
          window.location.reload();
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, currentUser]);

  const handlePhoneChange = (e) => {
    let val = e.target.value;
    if (authMode === 'login_staff') { setTempPhone(val); } 
    else { val = val.replace(/[^\d+]/g, ''); if (!val.startsWith('+7')) { val = '+7' + val.replace(/^\+?7?/, ''); } if (val.length > 12) val = val.slice(0, 12); setTempPhone(val); }
  };

  const handlePhoneSubmit = (e) => { 
    e.preventDefault(); 
    if (!tempPhone) return; 
    
    if (authMode === 'login_staff') {
      const staffMember = (roles || {})[tempPhone];
      if (!staffMember) return alert("❌ Неверный логин сотрудника!");
      if (staffMember.password !== tempPassword) return alert("❌ Неверный пароль!");
      if (!staffMember.onShift && staffMember.role !== 'admin') return alert("❌ Сегодня не ваша смена! Доступ закрыт.");
      
      const newToken = Date.now().toString(36) + Math.random().toString(36).substr(2);
      const updatedRoles = { ...roles, [tempPhone]: { ...staffMember, sessionToken: newToken } };
      setRoles(updatedRoles);
      
      setCurrentUser({ role: staffMember.role, phone: tempPhone, name: staffMember.name, station: staffMember.station || null, isSenior: staffMember.isSenior || false, sessionToken: newToken });
      setIsAuthenticated(true);
      setShowAuthModal(false);
    } else {
      if (tempPhone.length !== 12) return alert("❌ Введите полный номер: +7XXXXXXXXXX");
      if (authMode === 'login_guest' && !customers[tempPhone]) return alert("❌ Номер не найден! Создайте карту лояльности.");
      if (authMode === 'register_guest' && customers[tempPhone]) return alert("❌ Этот номер уже есть в базе! Войдите как гость.");
      setAuthStep('sms'); 
    }
  };
  
  const handleSmsSubmit = (e) => { 
    e.preventDefault(); 
    if (tempCode !== '1234') return alert("❌ Проверочный код: 1234"); 
    if (authMode === 'login_guest') { 
      setCurrentUser({ role: 'guest', phone: tempPhone, name: customers[tempPhone].name || 'Гость', station: null, sessionToken: null }); 
      setIsAuthenticated(true);
      setShowAuthModal(false); 
    } else { setAuthStep('details'); } 
  };
  
  const handleDetailsSubmit = (e) => { 
    e.preventDefault(); 
    if (!tempName) return alert("Введите имя!");
    setCustomers(prev => ({ ...(prev || {}), [tempPhone]: { phone: tempPhone, name: tempName, bonuses: 500, sessionToken: null } })); 
    setCurrentUser({ role: 'guest', phone: tempPhone, name: tempName, station: null, sessionToken: null }); 
    setIsAuthenticated(true);
    setShowAuthModal(false);
    alert("🎉 Успешно! Вам начислено 500 приветственных бонусов!");
  };

  const logoutOrLogin = () => { 
    if (!isAuthenticated) { setAuthMode('login_guest'); setAuthStep('phone'); setTempPhone('+7'); setShowAuthModal(true); } 
    else { setIsAuthenticated(false); setCurrentUser({role: 'guest', phone: '', name: '', station: null, sessionToken: null}); }
  };

  if (showSplash) {
    return (
      <div style={{position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', flexDirection: 'column', zIndex: 99999, overflow: 'hidden'}}>
        <div style={{width: '240px', height: '240px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', marginBottom: '20px', overflow: 'hidden'}}>
           <img src="/amina-logo.png.jpg" alt="Logo" style={{width: '100%', height: '100%', objectFit: 'contain'}} onError={(e) => { e.target.src = '/amina-logo.png'; }} />
        </div>
      </div>
    );
  }

  const activeUser = isAuthenticated ? currentUser : { role: 'guest', phone: '', name: 'Войти / Рег.', isAnonymous: true };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        :root { color-scheme: light only !important; }
        html, body { background-color: #f4f5f7 !important; color: #111827 !important; }
        input, select, textarea { background-color: #fff !important; color: #111827 !important; border: 1px solid #d1d5db !important; }
        input::placeholder, textarea::placeholder { color: #9ca3af !important; }
      `}} />

      {activeUser.role === 'guest' ? <GuestApp currentUser={activeUser} logout={logoutOrLogin} /> : <StaffApp currentUser={activeUser} logout={logoutOrLogin} />}
      
      {showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(17, 24, 39, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', zIndex: 99999, backdropFilter: 'blur(5px)' }}>
          <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '400px', textAlign: 'center', position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <button onClick={() => setShowAuthModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: '#f3f4f6', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', color: '#4b5563' }}>✕</button>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '22px', fontWeight: '900', color: '#111827' }}>
              {authMode === 'login_guest' ? 'Вход в аккаунт' : authMode === 'register_guest' ? 'Регистрация' : 'Сотрудники'}
            </h2>
            
            {authStep === 'phone' && (
              <form onSubmit={handlePhoneSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{textAlign: 'left'}}><label style={{fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginLeft: '5px'}}>Номер телефона</label><input type="tel" placeholder={authMode === 'login_staff' ? "Логин сотрудника" : "+7"} value={tempPhone} onChange={handlePhoneChange} required style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #e5e7eb', fontSize: '18px', color: '#111827', backgroundColor: '#f9fafb', boxSizing: 'border-box', fontWeight: 'bold', letterSpacing: '1px' }} /></div>
                {authMode === 'login_staff' && (<div style={{textAlign: 'left'}}><label style={{fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginLeft: '5px'}}>Пароль</label><input type="password" placeholder="Пароль" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} required style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #e5e7eb', fontSize: '16px', color: '#111827', backgroundColor: '#f9fafb', boxSizing: 'border-box' }} /></div>)}
                <button type="submit" style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', backgroundColor: authMode === 'login_staff' ? '#111827' : '#ea580c', color: '#fff', fontWeight: '900', fontSize: '16px', cursor: 'pointer', marginTop: '5px' }}>{authMode === 'login_staff' ? 'Авторизоваться' : 'Далее'}</button>
              </form>
            )}
            
            {authStep === 'sms' && (
              <form onSubmit={handleSmsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <p style={{margin: 0, fontSize: '13px', color: '#6b7280', fontWeight: 'bold'}}>Код отправлен на {tempPhone}<br/>(Для теста введите: 1234)</p>
                <input type="number" placeholder="Код из СМС" value={tempCode} onChange={(e) => setTempCode(e.target.value)} required style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #e5e7eb', textAlign: 'center', fontSize: '20px', fontWeight: 'bold', color: '#111827', backgroundColor: '#f9fafb', boxSizing: 'border-box', letterSpacing: '3px' }} />
                <button type="submit" style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: '900', fontSize: '16px', cursor: 'pointer' }}>Подтвердить</button>
              </form>
            )}
            
            {authStep === 'details' && (
              <form onSubmit={handleDetailsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{textAlign: 'left'}}><label style={{fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginLeft: '5px'}}>Как к вам обращаться?</label><input type="text" placeholder="Ваше Имя" value={tempName} onChange={(e) => setTempName(e.target.value)} required style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid #e5e7eb', fontSize: '16px', color: '#111827', backgroundColor: '#f9fafb', boxSizing: 'border-box', fontWeight: 'bold' }} /></div>
                <button type="submit" style={{ width: '100%', padding: '16px', borderRadius: '14px', border: 'none', backgroundColor: '#ea580c', color: '#fff', fontWeight: '900', fontSize: '16px', cursor: 'pointer' }}>Создать аккаунт</button>
              </form>
            )}

            <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
              {authMode !== 'login_guest' && authStep === 'phone' && <button onClick={() => {setAuthMode('login_guest'); setTempPhone('+7');}} style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }}>Уже есть аккаунт? Войти</button>}
              {authMode !== 'register_guest' && authStep === 'phone' && <button onClick={() => {setAuthMode('register_guest'); setTempPhone('+7');}} style={{ background: 'none', border: 'none', color: '#ea580c', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }}>Создать карту лояльности</button>}
              {authMode !== 'login_staff' && authStep === 'phone' && <button onClick={() => {setAuthMode('login_staff'); setTempPhone('');}} style={{ padding: '12px', borderRadius: '12px', border: '2px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', marginTop: '10px' }}>💼 Вход для персонала</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AppWrapper() {
  return <ErrorBoundary><MainApp /></ErrorBoundary>;
}