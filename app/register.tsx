import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform, Dimensions, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../lib/api';

const { width: windowWidth } = Dimensions.get('window');

export default function Register() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const pinRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !pin) {
      setError('All fields required');
      return;
    }

    const domainPattern = /^[\w.-]+@g\.msuiit\.edu\.ph$/i;
    if (!domainPattern.test(email)) {
      setError('Only @g.msuiit.edu.ph emails are allowed');
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits');
      pinRef.current?.focus();
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/register', {
        firstName,
        lastName,
        email,
        pin,
      });
      if (Platform.OS === 'web') {
        localStorage.setItem('migo-email', email);
      }
      setError('');
      router.push('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.logoContainer}>
          <View style={styles.logoWrapper}>
            <View style={styles.logoGlow} />
            <Image 
              source={require('../assets/images/logo.jpg')} 
              style={styles.logo} 
              resizeMode="contain" 
            />
          </View>
          <Text style={styles.appTitle}>Research Repository</Text>
          <Text style={styles.subtitle}>📚 Join our research community</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.title}>✨ Create Account</Text>
            <Text style={styles.subtitle2}>Get started in seconds</Text>
          </View>
          
          <View style={styles.nameRow}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.halfInput}
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                placeholderTextColor="#64748b"
                editable={!isLoading}
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.halfInput}
                placeholder="Last Name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                placeholderTextColor="#64748b"
                editable={!isLoading}
              />
            </View>
          </View>

          <View style={styles.inputWrapperFull}>
            <Text style={styles.inputIcon}>📧</Text>
            <TextInput
              style={styles.inputFull}
              placeholder="yourname@g.msuiit.edu.ph"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#64748b"
              editable={!isLoading}
            />
          </View>

          <View style={styles.pinInputContainer}>
            <View style={styles.inputWrapperFull}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                ref={pinRef}
                style={styles.inputFull}
                placeholder="Create 6-digit PIN"
                value={pin}
                onChangeText={setPin}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                placeholderTextColor="#64748b"
                editable={!isLoading}
              />
            </View>
            <View style={styles.pinIndicator}>
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <View key={i} style={styles.pinDotWrap}>
                    <View
                      style={[
                        styles.pinDot,
                        pin[i] && styles.pinDotFilled,
                      ]}
                    />
                  </View>
                ))}
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]} 
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {isLoading ? '⏳ Creating Account...' : '🚀 Register'}
            </Text>
          </TouchableOpacity>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.divider} />

          <TouchableOpacity 
            onPress={() => router.push('/login')}
            style={styles.loginLinkContainer}
          >
            <Text style={styles.loginLink}>
              Already have an account?{' '}
              <Text style={styles.loginLinkBold}>Sign In →</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          🔒 By registering, you agree to our terms of service
        </Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 500,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoWrapper: {
    marginBottom: 20,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: Platform.OS === 'web' ? 180 : 150,
    height: Platform.OS === 'web' ? 180 : 150,
    borderRadius: 90,
    backgroundColor: '#6366f1',
    opacity: 0.15,
  },
  logo: {
    width: Platform.OS === 'web' ? 130 : 110,
    height: Platform.OS === 'web' ? 130 : 110,
    borderRadius: 65,
    borderWidth: 4,
    borderColor: '#1e293b',
  },
  appTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.5,
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
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle2: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 14,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1419',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2d3548',
    paddingHorizontal: 16,
    gap: 12,
  },
  inputWrapperFull: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1419',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2d3548',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 14,
  },
  inputIcon: {
    fontSize: 20,
  },
  halfInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#f1f5f9',
    fontWeight: '500',
  },
  inputFull: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#f1f5f9',
    fontWeight: '500',
  },
  pinInputContainer: {
    width: '100%',
    marginBottom: 8,
  },
  pinIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  pinDotWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#2d3548',
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3d4558',
  },
  pinDotFilled: {
    backgroundColor: '#818cf8',
    shadowColor: '#818cf8',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  button: {
    width: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    borderWidth: 1,
    borderColor: '#7c7ff1',
  },
  buttonDisabled: {
    backgroundColor: '#475569',
    borderColor: '#64748b',
    shadowOpacity: 0.2,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#dc2626',
    shadowColor: '#dc2626',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  errorIcon: {
    fontSize: 18,
  },
  error: {
    color: '#fecaca',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: '#2d3548',
    alignSelf: 'center',
    marginVertical: 8,
  },
  loginLinkContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginLink: {
    color: '#64748b',
    textAlign: 'center',
    fontSize: 15,
  },
  loginLinkBold: {
    fontWeight: '700',
    color: '#a5b4fc',
  },
  disclaimer: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
    fontWeight: '500',
  },
});