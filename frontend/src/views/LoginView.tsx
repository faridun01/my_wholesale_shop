import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, loginWithTwoFactor } from '../api/auth.api';
import { ArrowLeft, ArrowRight, KeyRound, Loader2, Lock, User, Warehouse } from 'lucide-react';
import { motion } from 'motion/react';
import { setAuthSession } from '../utils/authStorage';

export default function LoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorUsername, setTwoFactorUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await login({ username, password });
      if (result.requiresTwoFactor) {
        setTwoFactorToken(result.twoFactorToken);
        setTwoFactorUsername(result.user?.username || username);
        setTwoFactorCode('');
        return;
      }

      setAuthSession(result.token, result.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await loginWithTwoFactor({
        twoFactorToken,
        code: twoFactorCode,
      });
      setAuthSession(result.token, result.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Two-factor verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resetTwoFactorStep = () => {
    setTwoFactorToken('');
    setTwoFactorCode('');
    setTwoFactorUsername('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl lg:grid-cols-2"
      >
        <section className="hidden flex-col justify-center bg-slate-900 p-10 text-white lg:flex">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-700">
              <Warehouse size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Wholesale CRM</h1>
              <p className="text-sm text-slate-300">Secure inventory workspace</p>
            </div>
          </div>

          <h2 className="mb-4 text-3xl font-semibold leading-tight">
            Safe access to warehouse, sales and customer operations
          </h2>

          <p className="text-sm leading-7 text-slate-300">
            Sign in with your account and, if enabled, confirm the session with a code from your authenticator app.
          </p>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-8 lg:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center lg:text-left">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 lg:mx-0">
                <Warehouse size={26} />
              </div>
              <h2 className="text-3xl font-semibold text-slate-900">
                {twoFactorToken ? 'Two-factor verification' : 'Sign in'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {twoFactorToken
                  ? 'Enter the code from your authenticator app or one backup code.'
                  : 'Enter your username and password to continue.'}
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {!twoFactorToken ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Username</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Enter username"
                      className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter password"
                      className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleTwoFactorSubmit} className="space-y-5">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                  Two-factor protection is enabled for <span className="font-bold">{twoFactorUsername}</span>.
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Authenticator code or backup code</label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      required
                      value={twoFactorCode}
                      onChange={(event) => setTwoFactorCode(event.target.value)}
                      placeholder="123456 or ABCDE-12345"
                      className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-sm text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={resetTwoFactorStep}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm sign in</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </motion.div>
    </div>
  );
}
