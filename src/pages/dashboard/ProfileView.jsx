import { useEffect, useState } from 'react';
import { Camera, CheckCircle2, Eye, EyeOff, KeyRound, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { workspaceApi } from '../../services/workspaceApi.js';

export default function ProfileView() {
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [aadhaar, setAadhaar] = useState(user?.aadhaar || '');
  const [photoDataUrl, setPhotoDataUrl] = useState(user?.photoDataUrl || '');
  const [showAadhaar, setShowAadhaar] = useState(false);

  const [profileStatus, setProfileStatus] = useState({ type: '', message: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwdStatus, setPwdStatus] = useState({ type: '', message: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    workspaceApi
      .getProfile()
      .then((res) => {
        if (res.profile) {
          setFullName(res.profile.fullName || '');
          setPhone(res.profile.phone || '');
          setEmail(res.profile.email || '');
          setAadhaar(res.profile.aadhaar || '');
          setPhotoDataUrl(res.profile.photoDataUrl || '');
        }
      })
      .catch(() => {});
  }, []);

  function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileStatus({ type: 'error', message: 'Please select a valid image file (PNG, JPG, or WebP).' });
      e.target.value = '';
      return;
    }
    if (file.size > 1024 * 1024) {
      setProfileStatus({ type: 'error', message: 'Profile photo must be under 1 MB.' });
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(String(reader.result || ''));
      setProfileStatus({ type: '', message: '' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileStatus({ type: '', message: '' });

    const cleanAadhaar = aadhaar.replace(/\s+/g, '');
    if (fullName.trim().length < 2) {
      setProfileStatus({ type: 'error', message: 'Full name must be at least 2 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setProfileStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    if (cleanAadhaar && !/^\d{12}$/.test(cleanAadhaar)) {
      setProfileStatus({ type: 'error', message: 'Aadhaar number must be exactly 12 digits.' });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await workspaceApi.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        aadhaar: cleanAadhaar,
        photoDataUrl,
      });
      if (res.profile) updateUser(res.profile);
      setProfileStatus({ type: 'success', message: res.message || 'Account profile updated.' });
    } catch (err) {
      setProfileStatus({ type: 'error', message: err.message });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwdStatus({ type: '', message: '' });

    if (!currentPassword) {
      setPwdStatus({ type: 'error', message: 'Current password is required.' });
      return;
    }
    if (newPassword.length < 8 || !/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      setPwdStatus({
        type: 'error',
        message: 'New password must be at least 8 characters and include letters and numbers.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdStatus({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    setSavingPwd(true);
    try {
      const res = await workspaceApi.changePassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdStatus({ type: 'success', message: res.message || 'Password updated successfully.' });
    } catch (err) {
      setPwdStatus({ type: 'error', message: err.message });
    } finally {
      setSavingPwd(false);
    }
  }

  const maskedAadhaar =
    aadhaar.length === 12 ? `XXXX XXXX ${aadhaar.slice(8)}` : aadhaar || 'Not set';

  const initials = (fullName || 'FF')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="row g-3">
      {/* Account Profile */}
      <div className="col-lg-7">
        <div className="ff-card p-3 p-sm-4 h-100 d-flex flex-column">
          <h2 className="h5 fw-bold mb-1">Account Profile</h2>
          <p className="text-secondary small mb-3">
            Manage your name, contact details, and profile photo.
          </p>

          {profileStatus.message && (
            <div
              className={`alert ${profileStatus.type === 'error' ? 'alert-danger' : 'alert-success'} small`}
              role="status"
            >
              {profileStatus.message}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="d-flex flex-column gap-3 flex-grow-1">
            <div className="d-flex flex-wrap align-items-center gap-3 pb-3 border-bottom">
              <div
                className="ff-avatar-circle"
                style={{ width: '60px', height: '60px', fontSize: '1.1rem' }}
              >
                {photoDataUrl ? (
                  <img src={photoDataUrl} alt={fullName} className="w-100 h-100 object-fit-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="d-flex flex-wrap gap-2">
                <label className="btn btn-sm btn-ff-outline d-inline-flex align-items-center gap-1 mb-0">
                  <Camera size={15} />
                  <span>Upload Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="d-none"
                    onChange={handlePhotoUpload}
                  />
                </label>
                {photoDataUrl && (
                  <button
                    type="button"
                    className="btn btn-sm btn-light border text-danger d-inline-flex align-items-center gap-1"
                    onClick={() => setPhotoDataUrl('')}
                  >
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>

            <div className="row g-3">
              <div className="col-sm-6">
                <label className="form-label small fw-semibold">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="col-sm-6">
                <label className="form-label small fw-semibold">Phone Number</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="col-sm-6">
                <label className="form-label small fw-semibold">Email Address *</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="col-sm-6">
                <label className="form-label small fw-semibold">
                  Aadhaar Number (12 digits)
                </label>
                <div className="input-group">
                  <input
                    type={showAadhaar ? 'text' : 'password'}
                    maxLength={12}
                    className="form-control ff-mono"
                    placeholder="Enter 12 digits"
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary border"
                    aria-label={showAadhaar ? 'Hide Aadhaar' : 'Show Aadhaar'}
                    onClick={() => setShowAadhaar((p) => !p)}
                  >
                    {showAadhaar ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="form-text ff-mono">Saved: {maskedAadhaar}</div>
              </div>
            </div>

            <div className="mt-auto pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="btn btn-ff-primary d-inline-flex align-items-center gap-2"
              >
                <Save size={16} />
                <span>{savingProfile ? 'Saving...' : 'Update Profile'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Change Password */}
      <div className="col-lg-5">
        <div className="ff-card p-3 p-sm-4 h-100 d-flex flex-column">
          <div className="d-flex align-items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-primary" />
            <h2 className="h5 fw-bold mb-0">Change Password</h2>
          </div>
          <p className="text-secondary small mb-3">
            Update your account password to keep your workspace secure.
          </p>

          {pwdStatus.message && (
            <div
              className={`alert ${pwdStatus.type === 'error' ? 'alert-danger' : 'alert-success'} small d-flex align-items-center gap-2`}
              role="status"
            >
              {pwdStatus.type === 'success' && <CheckCircle2 size={16} />}
              <span>{pwdStatus.message}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="d-flex flex-column gap-3 flex-grow-1">
            <div>
              <label className="form-label small fw-semibold">Current Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="current-password"
                className="form-control"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label small fw-semibold">New Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                className="form-control"
                placeholder="At least 8 characters with letters and numbers"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label small fw-semibold">Confirm New Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="new-password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="form-check">
              <input
                id="toggle-pwd-vis"
                type="checkbox"
                className="form-check-input"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
              />
              <label htmlFor="toggle-pwd-vis" className="form-check-label small text-secondary">
                Show passwords
              </label>
            </div>

            <div className="mt-auto pt-2">
              <button
                type="submit"
                disabled={savingPwd}
                className="btn btn-ff-outline d-inline-flex align-items-center justify-content-center gap-2"
              >
                <KeyRound size={16} />
                <span>{savingPwd ? 'Updating...' : 'Change Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
