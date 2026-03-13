import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus, Mail, Lock, ShieldCheck, AlertCircle } from 'lucide-react';
import { tenantConfig } from '../config/tenant';
import { useTranslation } from 'react-i18next';
const Auth = ({ onLogin }) => {
    const { t } = useTranslation();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nombre, setNombre] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [forceChange, setForceChange] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const validateDomain = (email) => {
        return true; // Allow all domains for the initial setup
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        if (!validateDomain(email)) {
            setError(t('auth.alerts.domain_restricted'));
            setLoading(false);
            return;
        }

        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            nombre: nombre,
                        },
                    },
                });
                if (error) throw error;
                setMessage(t('auth.alerts.signup_success'));
            } else {
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (authError) throw authError;

                // Check for forced change flag
                const { data: userData, error: userError } = await supabase
                    .from('Usuarios')
                    .select('debe_cambiar_password')
                    .eq('email', email)
                    .single();

                if (userData?.debe_cambiar_password) {
                    setForceChange(true);
                    return; // Don't trigger onLogin yet
                }

                if (onLogin) onLogin();
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForceChange = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError(t('auth.alerts.password_mismatch'));
            return;
        }
        if (newPassword.length < 6) {
            setError(t('auth.alerts.password_too_short'));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Update password in Auth
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) throw updateError;

            const { error: dbError } = await supabase
                .from('Usuarios')
                .update({ debe_cambiar_password: false })
                .eq('email', email);
            if (dbError) throw dbError;

            setMessage(t('auth.alerts.password_updated'));
            setTimeout(() => {
                if (onLogin) onLogin();
            }, 1500);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (forceChange) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', padding: '2rem' }}>
                <div style={{ maxWidth: '450px', width: '100%', background: 'white', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)', padding: '2.5rem', border: '1px solid #f1f5f9' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <ShieldCheck size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', display: 'inline-block' }} />
                        <h1 style={{ fontFamily: 'Outfit', fontSize: '1.5rem', fontWeight: '800', color: '#1e293b' }}>{t('auth.force_change_title')}</h1>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>{t('auth.force_change_desc')}</p>
                    </div>

                    <form onSubmit={handleForceChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: '#475569' }}>{t('auth.new_password_label')}</label>
                            <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: '#475569' }}>{t('auth.confirm_password_label')}</label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                            />
                        </div>

                        {error && <div style={{ color: '#dc2626', fontSize: '0.8rem' }}>{error}</div>}
                        {message && <div style={{ color: '#16a34a', fontSize: '0.8rem' }}>{message}</div>}

                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '0.85rem', borderRadius: '12px', fontWeight: '700' }}>
                            {loading ? t('auth.updating') : t('auth.update_btn')}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            padding: '2rem'
        }}>
            <div style={{
                maxWidth: '450px',
                width: '100%',
                background: 'white',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
                padding: '2.5rem',
                border: '1px solid #f1f5f9'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <img src={tenantConfig.logoUrl} alt={tenantConfig.name} style={{ width: '160px', marginBottom: '1.5rem', objectFit: 'contain' }} />
                    <h1 style={{ fontFamily: 'Outfit', fontSize: '1.5rem', fontWeight: '800', color: '#1e293b' }}>
                        {isSignUp ? t('auth.signup_title') : t('auth.login_title')}
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        {t('auth.subtitle', { name: tenantConfig.name })}
                    </p>
                </div>

                <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {isSignUp && (
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: '#475569' }}>{t('auth.name_label')}</label>
                            <div style={{ position: 'relative' }}>
                                <ShieldCheck size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    required
                                    placeholder={t('auth.name_placeholder')}
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: '#475569' }}>{t('auth.email_label')}</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                            <input
                                type="email"
                                required
                                placeholder={t('auth.email_placeholder')}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: '#475569' }}>{t('auth.password_label')}</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                            <input
                                type="password"
                                required
                                placeholder={t('auth.password_placeholder')}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.8rem' }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {message && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '0.8rem' }}>
                            <ShieldCheck size={16} />
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                        style={{ padding: '0.85rem', borderRadius: '12px', fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                    >
                        {loading ? t('auth.processing') : isSignUp ? <><UserPlus size={20} /> {t('auth.signup_btn')}</> : <><LogIn size={20} /> {t('auth.login_btn')}</>}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {isSignUp ? t('auth.have_account_question') : t('auth.new_admin_question')}
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '700', marginLeft: '6px', cursor: 'pointer' }}
                        >
                            {isSignUp ? t('auth.login_link') : t('auth.create_account_btn')}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Auth;
