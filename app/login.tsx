import React, { useState, useEffect, useRef, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  TouchableOpacity,
  TextInput,
  Pressable,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { saveToken } from '../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';

const { width: windowWidth } = Dimensions.get('window');
const BUTTON_SIZE = 72;
const NUMBER_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '←'],
];

/* ----------------------------- Domain constants ----------------------------- */
const ALLOWED_DOMAIN = 'g.msuiit.edu.ph';
const DOMAIN_SUFFIX = `@${ALLOWED_DOMAIN}`;

/* Normalize any user input to a full email on the allowed domain.
   - "juan" -> "juan@g.msuiit.edu.ph"
   - "juan@g.msuiit.edu.ph" -> same
   - "juan@gmail.com" -> returns "" (invalid domain) */
const normalizeEmailInput = (raw: string): { email: string; error?: string } => {
  const t = (raw || '').trim();
  if (!t) return { email: '' };

  if (t.includes('@')) {
    const [local, dom] = t.split('@');
    if (!local) return { email: '' };
    if ((dom || '').toLowerCase() !== ALLOWED_DOMAIN) {
      return { email: '', error: `Only ${DOMAIN_SUFFIX} accounts are allowed.` };
    }
    return { email: `${local}@${ALLOWED_DOMAIN}` };
  }
  return { email: `${t}${DOMAIN_SUFFIX}` };
};

/* ----------------------------- Helper: Shared Redirect Logic ----------------------------- */
const redirectByRole = (router, role) => {
  if (role === 'admin') router.replace('/admin');
  else if (role === 'faculty') router.replace('/faculty');
  else if (role === 'staff') router.replace('/staff');
  else router.replace('/(tabs)');
};

/* ----------------------------- WEB PIN INPUT ----------------------------- */
const PinDotsInputWeb = forwardRef(({ value, onChangeText, autoFocus }: any, ref: any) => (
  <Pressable
    style={webPinStyles.pinContainer as any}
    onPress={() => {
      if (ref && 'current' in ref && ref.current) {
        ref.current.focus?.();
      }
    }}
  >
    <View style={webPinStyles.pinDotsRow as any}>
      {Array(6)
        .fill(0)
        .map((_, i) => (
          <View key={i} style={webPinStyles.dotWrap as any}>
            <View style={[webPinStyles.dot as any, value[i] && (webPinStyles.dotFilled as any)]} />
          </View>
        ))}
    </View>
    <TextInput
      ref={ref}
      value={value}
      onChangeText={(t) => {
        if (/^\d*$/.test(t) && t.length <= 6) onChangeText(t);
      }}
      style={webPinStyles.hiddenInput as any}
      keyboardType="numeric"
      inputMode="numeric"
      maxLength={6}
      autoFocus={autoFocus}
      secureTextEntry
      caretHidden
      contextMenuHidden
    />
  </Pressable>
));

/* ----------------------------- NATIVE PIN + DIAL ----------------------------- */
function PinDotsAndDial({ pin, handleDial, error }) {
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef(Array(10).fill(0).map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  const animateButton = (index: number) => {
    Animated.sequence([
      Animated.timing(scaleAnims[index], {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnims[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <>
      <Animated.View style={[dialStyles.pinDotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array(6)
          .fill(0)
          .map((_, i) => (
            <View key={`dot-${i}`} style={dialStyles.dotWrap}>
              <View style={[dialStyles.dot, pin[i] && dialStyles.dotFilled, error && dialStyles.dotError]} />
            </View>
          ))}
      </Animated.View>

      <View style={dialStyles.dialWrap}>
        {NUMBER_ROWS.map((row, i) => (
          <View key={`row-${i}`} style={dialStyles.dialRow}>
            {row.map((num, j) => {
              const flatIndex = i * 3 + j;
              if (!num) return <View key={`empty-${i}-${j}`} style={dialStyles.dialBtnEmpty} />;
              if (num === '←') {
                return (
                  <Animated.View key={`back-${i}-${j}`} style={{ transform: [{ scale: scaleAnims[9] }] }}>
                    <TouchableOpacity 
                      style={dialStyles.dialBtnBack} 
                      onPress={() => {
                        animateButton(9);
                        handleDial(num);
                      }} 
                      activeOpacity={0.6}
                    >
                      <Text style={dialStyles.dialBackIcon}>⌫</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              }
              return (
                <Animated.View key={`num-${num}-${i}-${j}`} style={{ transform: [{ scale: scaleAnims[flatIndex] }] }}>
                  <TouchableOpacity
                    style={dialStyles.dialBtn}
                    onPress={() => {
                      animateButton(flatIndex);
                      handleDial(num);
                    }}
                    activeOpacity={0.7}
                    disabled={pin.length >= 6}
                  >
                    <Text style={dialStyles.dialNum}>{num}</Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>
    </>
  );
}

/* ----------------------------- NATIVE LOGIN ----------------------------- */
function AppLogin() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [hasSavedEmail, setHasSavedEmail] = useState(false);
  const [showDial, setShowDial] = useState(false);
  const emailInputRef = useRef<TextInput | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true })
    ]).start();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('repo-email').then((saved) => {
      if (saved) {
        setIdentifier(saved);
        setHasSavedEmail(true);
        setShowDial(true);
      } else {
        setIdentifier('');
        setHasSavedEmail(false);
        setShowDial(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!hasSavedEmail && identifier.trim().length > 0) setShowDial(true);
    else if (!hasSavedEmail) setShowDial(false);
  }, [identifier, hasSavedEmail]);

  useEffect(() => {
    if (/^\d{6}$/.test(pin) && identifier) handleLogin(pin);
  }, [pin]);

  const handleLogin = async (inputPin: string) => {
    const alreadyFull = identifier.includes('@') && identifier.toLowerCase().endsWith(DOMAIN_SUFFIX);
    const { email, error: normErr } = alreadyFull ? { email: identifier } : normalizeEmailInput(identifier);

    if (normErr) {
      setError(normErr);
      setTimeout(() => setError(''), 1600);
      return;
    }
    if (!email) {
      setError('Enter a valid username or institutional email.');
      setTimeout(() => setError(''), 1600);
      return;
    }

    try {
      const response = await api.post('/auth/login', { email, pin: inputPin });
      const data = response.data;

      if (data.needsVerification) {
        router.push(`/verify-code?email=${encodeURIComponent(email)}`);
        return;
      }

      await saveToken(data.user);
      await AsyncStorage.setItem('repo-email', email);
      redirectByRole(router, data.user.role);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'PIN incorrect');
      setTimeout(() => {
        setPin('');
        setError('');
      }, 1500);
    }
  };

  const handleSwitchAccount = async () => {
    await AsyncStorage.removeItem('repo-email');
    setHasSavedEmail(false);
    setIdentifier('');
    setPin('');
    setError('');
    setShowDial(false);
    setTimeout(() => emailInputRef.current?.focus(), 200);
  };

  const handleDial = (value: string) => {
    if (value === '←') setPin((p) => p.slice(0, -1));
    else if (value && pin.length < 6) setPin((p) => p + value);
  };

  const onChangeIdentifier = (t: string) => {
    if (t.includes('@') && !t.toLowerCase().endsWith(DOMAIN_SUFFIX)) {
      setError(`Use your institutional address (${DOMAIN_SUFFIX}) or just type your username.`);
    } else {
      if (error) setError('');
    }
    setIdentifier(t.replace(/\s+/g, ''));
  };

  const showSuffixHint = !hasSavedEmail && !identifier.includes('@') && identifier.length > 0;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.topContent}>
          <View style={styles.logoContainer}>
            <View style={styles.logoGlow} />
            <Image source={require('../assets/images/logo.jpg')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.welcome}>Welcome to</Text>
          <Text style={styles.brand}>Research Repository</Text>
          <Text style={styles.tagline}>Access • Analyze • Advance Research</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.accountLabel}>{hasSavedEmail ? '👋 Welcome Back' : '🔐 Sign In'}</Text>
          </View>

          {hasSavedEmail ? (
            <>
              <View style={styles.emailBadge}>
                <View style={styles.emailBadgeIcon}>
                  <Text style={styles.emailBadgeIconText}>✓</Text>
                </View>
                <Text style={styles.accountEmail}>{identifier}</Text>
              </View>
              <PinDotsAndDial pin={pin} handleDial={handleDial} error={!!error} />
              <TouchableOpacity onPress={handleSwitchAccount} style={styles.switchButton}>
                <Text style={styles.switchAcc}>↻ Switch Account</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <View style={styles.usernameRow}>
                  <Text style={styles.inputIcon}>👤</Text>
                  <TextInput
                    ref={emailInputRef}
                    style={[styles.emailInput, { flex: 1 }]}
                    placeholder="Username or email"
                    value={identifier}
                    onChangeText={onChangeIdentifier}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholderTextColor="#64748b"
                    autoFocus
                  />
                  {showSuffixHint && (
                    <View style={styles.suffixPill}>
                      <Text style={styles.suffixText}>{DOMAIN_SUFFIX}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.helperText}>
                  💡 Tip: Just type <Text style={styles.helperBold}>juan</Text> — we'll add {DOMAIN_SUFFIX}
                </Text>
              </View>
              {showDial && <PinDotsAndDial pin={pin} handleDial={handleDial} error={!!error} />}
            </>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.push('/reset-pin')} style={styles.footerButton}>
              <Text style={styles.forgotPin}>🔑 Forgot PIN?</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity onPress={() => router.push('/register')} style={styles.footerButton}>
              <Text style={styles.registerLinkText}>
                New here? <Text style={styles.registerLink}>Create Account →</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footerInfo}>🔒 Secured with end-to-end encryption</Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

/* ----------------------------- WEB LOGIN ----------------------------- */
function WebLogin() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [hasSavedEmail, setHasSavedEmail] = useState(false);
  const pinInputRef = useRef<any>(null);
  const emailInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('repo-email').then((saved) => {
      if (saved) {
        setIdentifier(saved);
        setHasSavedEmail(true);
        setTimeout(() => pinInputRef.current?.focus(), 300);
      } else {
        setIdentifier('');
        setHasSavedEmail(false);
        setTimeout(() => emailInputRef.current?.focus(), 300);
      }
    });
  }, []);

  useEffect(() => {
    if (/^\d{6}$/.test(pin) && identifier) handleLogin(pin);
  }, [pin]);

  const handleLogin = async (inputPin: string) => {
    const alreadyFull = identifier.includes('@') && identifier.toLowerCase().endsWith(DOMAIN_SUFFIX);
    const { email, error: normErr } = alreadyFull ? { email: identifier } : normalizeEmailInput(identifier);

    if (normErr) {
      setError(normErr);
      setTimeout(() => setError(''), 1600);
      return;
    }
    if (!email) {
      setError('Enter a valid username or institutional email.');
      setTimeout(() => setError(''), 1600);
      return;
    }

    try {
      const response = await api.post('/auth/login', { email, pin: inputPin });
      const data = response.data;

      if (data.needsVerification) {
        router.push(`/verify-code?email=${encodeURIComponent(email)}`);
        return;
      }

      await saveToken(data.user);
      await AsyncStorage.setItem('repo-email', email);

      redirectByRole(router, data.user.role);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'PIN incorrect');
      setTimeout(() => {
        setPin('');
        setError('');
      }, 1500);
    }
  };

  const handleSwitchAccount = async () => {
    await AsyncStorage.removeItem('repo-email');
    setHasSavedEmail(false);
    setIdentifier('');
    setPin('');
    setError('');
    setTimeout(() => emailInputRef.current?.focus(), 300);
  };

  const onChangeIdentifier = (t: string) => {
    if (t.includes('@') && !t.toLowerCase().endsWith(DOMAIN_SUFFIX)) {
      setError(`Only ${DOMAIN_SUFFIX} accounts are allowed.`);
    } else {
      if (error) setError('');
    }
    setIdentifier(t.replace(/\s+/g, ''));
  };

  const showSuffixHint = !hasSavedEmail && !identifier.includes('@') && identifier.length > 0;

  return (
    <KeyboardAvoidingView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topContent}>
          <View style={styles.logoContainer}>
            <View style={styles.logoGlow} />
            <Image source={require('../assets/images/logo.jpg')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.welcome}>Welcome to</Text>
          <Text style={styles.brand}>Research Repository</Text>
          <Text style={styles.tagline}>Access • Analyze • Advance Research</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.accountLabel}>{hasSavedEmail ? '👋 Welcome Back' : '🔐 Sign In'}</Text>
          </View>

          {hasSavedEmail ? (
            <>
              <View style={styles.emailBadge}>
                <View style={styles.emailBadgeIcon}>
                  <Text style={styles.emailBadgeIconText}>✓</Text>
                </View>
                <Text style={styles.accountEmail}>{identifier}</Text>
              </View>
              <PinDotsInputWeb ref={pinInputRef} value={pin} onChangeText={setPin} autoFocus />
              <TouchableOpacity onPress={handleSwitchAccount} style={styles.switchButton}>
                <Text style={styles.switchAcc}>↻ Switch Account</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <View style={styles.usernameRow}>
                  <Text style={styles.inputIcon}>👤</Text>
                  <TextInput
                    ref={emailInputRef}
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Username or email"
                    value={identifier}
                    onChangeText={onChangeIdentifier}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholderTextColor="#64748b"
                    autoFocus
                  />
                  {showSuffixHint && (
                    <View style={styles.suffixPill}>
                      <Text style={styles.suffixText}>{DOMAIN_SUFFIX}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.helperText}>
                  💡 Tip: Just type <Text style={styles.helperBold}>juan</Text> — we'll add {DOMAIN_SUFFIX}
                </Text>
              </View>
              <PinDotsInputWeb ref={pinInputRef} value={pin} onChangeText={setPin} />
            </>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.push('/reset-pin')} style={styles.footerButton}>
              <Text style={styles.forgotPin}>🔑 Forgot PIN?</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity onPress={() => router.push('/register')} style={styles.footerButton}>
              <Text style={styles.registerLinkText}>
                New here? <Text style={styles.registerLink}>Create Account →</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footerInfo}>🔒 Secured with end-to-end encryption</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

export default Platform.OS === 'web' ? WebLogin : AppLogin;

/* ----------------------------- STYLES ----------------------------- */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0f1e', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  content: { 
    width: '100%', 
    maxWidth: 460, 
    alignItems: 'center' 
  },
  topContent: { 
    alignItems: 'center', 
    marginBottom: 48 
  },
  logoContainer: { 
    marginBottom: 28,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoGlow: {
    position: 'absolute',
    width: Platform.OS === 'web' ? 200 : 160,
    height: Platform.OS === 'web' ? 200 : 160,
    borderRadius: 100,
    backgroundColor: '#6366f1',
    opacity: 0.15,
  },
  logo: { 
    width: Platform.OS === 'web' ? 160 : 130, 
    height: Platform.OS === 'web' ? 160 : 130, 
    borderRadius: 80,
    borderWidth: 4,
    borderColor: '#1e293b',
  },
  welcome: { 
    fontSize: 16, 
    fontWeight: '500', 
    color: '#94a3b8', 
    marginBottom: 8, 
    letterSpacing: 1 
  },
  brand: { 
    fontSize: 34, 
    fontWeight: '800', 
    color: '#ffffff', 
    marginBottom: 12, 
    letterSpacing: -0.5 
  },
  tagline: { 
    fontSize: 14, 
    color: '#64748b', 
    letterSpacing: 1.5, 
    fontWeight: '600' 
  },
  card: {
    backgroundColor: '#1a1f35',
    width: '100%',
    borderRadius: 32,
    padding: 36,
    shadowColor: '#6366f1',
    shadowOpacity: 0.2,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 15 },
    elevation: 12,
    borderWidth: 1,
    borderColor: '#2d3548',
  },
  cardHeader: { 
    marginBottom: 28, 
    alignItems: 'center' 
  },
  accountLabel: { 
    color: '#f1f5f9', 
    fontSize: 26, 
    fontWeight: '700', 
    letterSpacing: -0.5 
  },
  emailBadge: {
    backgroundColor: '#2d3548',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 28,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#3d4558',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#6366f1',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  emailBadgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emailBadgeIconText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  accountEmail: { 
    color: '#a5b4fc', 
    fontSize: 16, 
    fontWeight: '600' 
  },

  inputContainer: { 
    marginBottom: 20 
  },
  input: {
    padding: 16,
    fontSize: 16,
    color: '#f1f5f9',
    fontWeight: '500',
  },
  emailInput: {
    padding: 16,
    fontSize: 16,
    color: '#f1f5f9',
    fontWeight: '500',
  },

  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1419',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2d3548',
    paddingHorizontal: 16,
    gap: 12
  },
  inputIcon: {
    fontSize: 20
  },
  suffixPill: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  suffixText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  helperText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 10,
    marginLeft: 4,
    lineHeight: 18
  },
  helperBold: {
    fontWeight: '700',
    color: '#818cf8'
  },

  switchButton: { 
    marginTop: 16, 
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  switchAcc: { 
    color: '#818cf8', 
    fontWeight: '600', 
    textAlign: 'center', 
    fontSize: 15 
  },

  footer: { 
    marginTop: 32, 
    gap: 16, 
    alignItems: 'center' 
  },
  footerButton: {
    paddingVertical: 4
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: '#2d3548',
    marginVertical: 4
  },
  forgotPin: { 
    color: '#818cf8', 
    fontWeight: '600', 
    fontSize: 15 
  },
  registerLinkText: { 
    color: '#64748b', 
    fontSize: 14 
  },
  registerLink: { 
    fontWeight: '700', 
    color: '#a5b4fc' 
  },

  errorContainer: {
    backgroundColor: '#7f1d1d',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#dc2626',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  errorIcon: {
    fontSize: 18
  },
  error: { 
    color: '#fecaca', 
    fontSize: 14, 
    fontWeight: '600',
    flex: 1
  },

  footerInfo: {
    marginTop: 24,
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500'
  }
});

/* ----------------------------- DIAL PAD ----------------------------- */
const dialStyles = StyleSheet.create({
  pinDotsRow: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginVertical: 24, 
    gap: 18 
  },
  dotWrap: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    width: 28, 
    height: 28, 
    backgroundColor: '#1e293b', 
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#2d3548'
  },
  dot: { 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    backgroundColor: '#3d4558'
  },
  dotFilled: { 
    backgroundColor: '#818cf8',
    shadowColor: '#818cf8',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }
  },
  dotError: { 
    backgroundColor: '#ef4444' 
  },
  dialWrap: { 
    marginTop: 20, 
    marginBottom: 12 
  },
  dialRow: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginBottom: 16, 
    gap: 20 
  },
  dialBtn: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#1e293b',
    alignItems:'center',
justifyContent: 'center',
borderWidth: 2,
borderColor: '#3d4558',
shadowColor: '#6366f1',
shadowOpacity: 0.3,
shadowRadius: 12,
shadowOffset: { width: 0, height: 6 }
},
dialNum: {
fontSize: 30,
fontWeight: '700',
color: '#f1f5f9'
},
dialBtnBack: {
width: BUTTON_SIZE,
height: BUTTON_SIZE,
alignItems: 'center',
justifyContent: 'center',
backgroundColor: '#1e293b',
borderRadius: BUTTON_SIZE / 2,
borderWidth: 2,
borderColor: '#3d4558',
shadowColor: '#ef4444',
shadowOpacity: 0.2,
shadowRadius: 10,
shadowOffset: { width: 0, height: 4 }
},
dialBackIcon: {
fontSize: 34,
color: '#f87171',
fontWeight: '700'
},
dialBtnEmpty: {
width: BUTTON_SIZE,
height: BUTTON_SIZE,
backgroundColor: 'transparent'
}
});
/* ----------------------------- WEB PIN STYLE ----------------------------- */
const webPinStyles = {
pinContainer: {
backgroundColor: '#0f1419',
borderWidth: 2,
borderColor: '#3d4558',
borderRadius: 20,
padding: 28,
width: '100%',
margin: '24px 0',
display: 'flex',
flexDirection: 'row' as const,
alignItems: 'center',
justifyContent: 'center',
cursor: 'pointer',
boxShadow: '0 8px 30px rgba(99, 102, 241, 0.2)',
},
pinDotsRow: {
flexDirection: 'row' as const,
display: 'flex',
justifyContent: 'center',
alignItems: 'center',
gap: 22
},
dotWrap: {
width: 32,
height: 32,
display: 'flex',
justifyContent: 'center',
alignItems: 'center',
backgroundColor: '#1e293b',
borderRadius: 16,
borderWidth: 2,
borderColor: '#2d3548'
},
dot: {
width: 16,
height: 16,
borderRadius: 8,
backgroundColor: '#3d4558',
transition: 'all 0.3s ease'
},
dotFilled: {
backgroundColor: '#818cf8',
transform: 'scale(1.15)',
boxShadow: '0 0 12px rgba(129, 140, 248, 0.6)'
},
hiddenInput: {
position: 'absolute' as const,
opacity: 0,
width: 1,
height: 1,
zIndex: -1
}
};